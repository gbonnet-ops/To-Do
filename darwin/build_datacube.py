"""Build Project Darwin Datacube — incremental, sheet by sheet."""
import pickle
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule, ColorScaleRule
from copy import copy

OUT = 'darwin/Project_Darwin_Datacube_v1.xlsx'
META = pickle.load(open('darwin/_meta.pkl','rb'))
ROWS = META['rows']            # list of (client,dept,prod,country,years[13])
CLIENTS = META['clients']      # dict
DEPTS = META['depts']          # ['CVA','Operations','Power','Software']
PRODS = META['prods']          # 19
COUNTRIES = META['countries']  # 24
YEARS = list(range(2014, 2027))  # 13 years
N_DATA = len(ROWS)             # 729

# Source_Evolution layout:
# Row 1: provenance note (merged)
# Row 2: headers: Client | Dept | Product | Country | FY2014A..FY2026A
# Rows 3..(3+N_DATA-1): data
SRC = 'Source_Evolution'
SRC_FIRST = 3
SRC_LAST = SRC_FIRST + N_DATA - 1   # 731
# year columns in source: E..Q
def src_year_col(yr):
    return get_column_letter(5 + (yr-2014))   # 2014 -> E

# ---------- Styling ----------
NAVY = 'FF173B57'
WHITE = 'FFFFFFFF'
YELLOW = 'FFFFF9E6'
LIGHT_GREY = 'FFF2F2F2'
THIN = Side(style='thin', color='FFBFBFBF')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
ARIAL = 'Arial'

def style_header(cell):
    cell.font = Font(name=ARIAL, size=11, bold=True, color=WHITE)
    cell.fill = PatternFill('solid', fgColor=NAVY)
    cell.alignment = Alignment(horizontal='center', vertical='center')
    cell.border = BORDER

def style_row_label(cell, bold=False, indent=0):
    cell.font = Font(name=ARIAL, size=10, bold=bold)
    cell.alignment = Alignment(horizontal='left', indent=indent)
    cell.border = BORDER

def style_num(cell, fmt='#,##0', bold=False, fill=None):
    cell.font = Font(name=ARIAL, size=10, bold=bold)
    cell.alignment = Alignment(horizontal='right')
    cell.number_format = fmt
    cell.border = BORDER
    if fill:
        cell.fill = PatternFill('solid', fgColor=fill)

def style_pct(cell, bold=False):
    style_num(cell, fmt='0.0%', bold=bold)

def style_mult(cell, bold=False):
    style_num(cell, fmt='0.0"x"', bold=bold)

def freeze(ws, cell='B3'):
    ws.freeze_panes = cell

def widen(ws, first_col_width=38, year_width=12):
    ws.column_dimensions['A'].width = first_col_width
    for i in range(2, 30):
        ws.column_dimensions[get_column_letter(i)].width = year_width

def add_year_headers(ws, start_row, start_col=2):
    for i, y in enumerate(YEARS):
        c = ws.cell(row=start_row, column=start_col+i, value=f'FY{y}A')
        style_header(c)

# ---------- Build workbook ----------
wb = Workbook()
wb.remove(wb.active)

# =============== Source_Info ===============
ws = wb.create_sheet('Source_Info')
ws['A1'] = "Source: GMSL_Revenue_Lines_Clip.xlsx — tab 'Info' — provided 5 Apr 2026"
ws['A1'].font = Font(name=ARIAL, size=9, italic=True, color='FF666666')
ws['A3'] = 'PROJECT DARWIN'
ws['A3'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)
ws['A4'] = 'This workbook contains commercially sensitive information which is Strictly Confidential and only to be used for the purposes of Project Darwin'
ws['A4'].font = Font(name=ARIAL, size=10, italic=True)
ws['A5'] = 'Source data date: 5 April 2026'
ws['A5'].font = Font(name=ARIAL, size=10)
ws.sheet_properties.tabColor = 'FFE6B800'
for r in range(1, 10):
    for c in range(1, 12):
        cell = ws.cell(row=r, column=c)
        if not cell.fill or cell.fill.fgColor.rgb != YELLOW:
            cell.fill = PatternFill('solid', fgColor=YELLOW)
ws.column_dimensions['A'].width = 120

# =============== Source_Evolution ===============
ws = wb.create_sheet(SRC)
ws.sheet_properties.tabColor = 'FFE6B800'
ws['A1'] = "Source: GMSL_Revenue_Lines_Clip.xlsx — tab 'Evolution' — 729 revenue lines, 372 clients, GBP, provided 5 Apr 2026"
ws['A1'].font = Font(name=ARIAL, size=9, italic=True, color='FF666666')
ws.merge_cells('A1:Q1')
# Headers row 2
hdrs = ['Client', 'Dept', 'Product', 'Country'] + [f'FY{y}A' for y in YEARS]
for j, h in enumerate(hdrs, start=1):
    c = ws.cell(row=2, column=j, value=h)
    style_header(c)
# Data rows
for i, (client, dept, prod, country, years) in enumerate(ROWS):
    r = SRC_FIRST + i
    ws.cell(row=r, column=1, value=client)
    ws.cell(row=r, column=2, value=dept)
    ws.cell(row=r, column=3, value=prod)
    ws.cell(row=r, column=4, value=country)
    for k, v in enumerate(years):
        cell = ws.cell(row=r, column=5+k, value=float(v))
        cell.number_format = '#,##0'
    # subtle yellow tint for source
    for j in range(1, 18):
        cell = ws.cell(row=r, column=j)
        cell.font = Font(name=ARIAL, size=9)
        cell.fill = PatternFill('solid', fgColor=YELLOW)
        cell.border = BORDER
        if j >= 5:
            cell.alignment = Alignment(horizontal='right')
ws.column_dimensions['A'].width = 32
ws.column_dimensions['B'].width = 14
ws.column_dimensions['C'].width = 18
ws.column_dimensions['D'].width = 16
for k in range(13):
    ws.column_dimensions[get_column_letter(5+k)].width = 12
ws.freeze_panes = 'E3'

print(f'Source_Evolution: rows {SRC_FIRST}..{SRC_LAST} ({N_DATA} data rows)')

# Helper to build SUMIFS over source given criteria dict {col_letter: criterion}
def src_sumifs(year, criteria):
    yc = src_year_col(year)
    rng = f"{SRC}!${yc}${SRC_FIRST}:${yc}${SRC_LAST}"
    parts = [rng]
    for col, crit in criteria.items():
        parts.append(f"{SRC}!${col}${SRC_FIRST}:${col}${SRC_LAST}")
        parts.append(crit)
    return f"=SUMIFS({','.join(parts)})"

def src_sum_all(year):
    yc = src_year_col(year)
    return f"=SUM({SRC}!${yc}${SRC_FIRST}:${yc}${SRC_LAST})"

# =============== Revenue Overview ===============
ws = wb.create_sheet('Revenue Overview')
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'Revenue Overview — Project Darwin (£ GBP)'
ws['A1'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)
# Header row 3
ws.cell(row=3, column=1, value='Metric')
style_header(ws.cell(row=3, column=1))
add_year_headers(ws, start_row=3, start_col=2)
# Add CAGR cols
ws.cell(row=3, column=15, value='CAGR FY14-FY23')
ws.cell(row=3, column=16, value='CAGR FY14-FY26')
style_header(ws.cell(row=3, column=15))
style_header(ws.cell(row=3, column=16))

# Row 4: Total revenue
ws.cell(row=4, column=1, value='Total revenue (£)')
style_row_label(ws.cell(row=4, column=1), bold=True)
for i, y in enumerate(YEARS):
    c = ws.cell(row=4, column=2+i, value=src_sum_all(y))
    style_num(c, bold=True, fill=LIGHT_GREY)
# CAGRs
ws.cell(row=4, column=15, value='=IFERROR((J4/B4)^(1/9)-1,"-")')   # 2014->2023
style_pct(ws.cell(row=4, column=15), bold=True)
ws.cell(row=4, column=16, value='=IFERROR((N4/B4)^(1/12)-1,"-")')  # 2014->2026
style_pct(ws.cell(row=4, column=16), bold=True)

# Row 5: YoY growth
ws.cell(row=5, column=1, value='YoY growth %')
style_row_label(ws.cell(row=5, column=1))
ws.cell(row=5, column=2, value='-').alignment = Alignment(horizontal='right')
for i in range(1, 13):
    col = get_column_letter(2+i)
    prev = get_column_letter(1+i)
    c = ws.cell(row=5, column=2+i, value=f'=IFERROR({col}4/{prev}4-1,"-")')
    style_pct(c)

# Row 6: Indexed (FY14=100)
ws.cell(row=6, column=1, value='Indexed (FY14 = 100)')
style_row_label(ws.cell(row=6, column=1))
for i in range(13):
    col = get_column_letter(2+i)
    c = ws.cell(row=6, column=2+i, value=f'=IFERROR({col}4/$B$4*100,"-")')
    style_num(c, fmt='0')

# Row 8: Active revenue lines
ws.cell(row=8, column=1, value='# Active revenue lines')
style_row_label(ws.cell(row=8, column=1))
for i, y in enumerate(YEARS):
    yc = src_year_col(y)
    f = f'=COUNTIFS({SRC}!${yc}${SRC_FIRST}:${yc}${SRC_LAST},">0")'
    c = ws.cell(row=8, column=2+i, value=f)
    style_num(c, fmt='#,##0')

# Conditional formatting on YoY row
ws.conditional_formatting.add('C5:N5',
    CellIsRule(operator='greaterThan', formula=['0'],
               fill=PatternFill('solid', fgColor='FFD9F2D9')))
ws.conditional_formatting.add('C5:N5',
    CellIsRule(operator='lessThan', formula=['0'],
               fill=PatternFill('solid', fgColor='FFF8D7DA')))

widen(ws, first_col_width=32, year_width=13)
ws.column_dimensions['O'].width = 15
ws.column_dimensions['P'].width = 15
ws.freeze_panes = 'B4'

# =============== Software vs Services ===============
ws = wb.create_sheet('Software vs Services')
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'Software vs Services — Revenue split (£ GBP)'
ws['A1'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)
ws['A2'] = 'Software = Dept "Software". Services = Dept "Operations" + "CVA" + "Power".'
ws['A2'].font = Font(name=ARIAL, size=9, italic=True, color='FF666666')

ws.cell(row=4, column=1, value='Metric')
style_header(ws.cell(row=4, column=1))
add_year_headers(ws, start_row=4, start_col=2)
style_header(ws.cell(row=4, column=15, value='CAGR FY14-FY26'))

# Software / Services / Total
def sumifs_dept(year, dept):
    return src_sumifs(year, {'B': f'"{dept}"'})

# Row 5: Software revenue
ws.cell(row=5, column=1, value='Software revenue (£)')
style_row_label(ws.cell(row=5, column=1), bold=True)
for i, y in enumerate(YEARS):
    style_num(ws.cell(row=5, column=2+i, value=sumifs_dept(y,'Software')), bold=True)
ws.cell(row=5, column=15, value='=IFERROR((N5/B5)^(1/12)-1,"-")')
style_pct(ws.cell(row=5, column=15), bold=True)

# Row 6: Services revenue (sum of 3 depts)
ws.cell(row=6, column=1, value='Services revenue (£)')
style_row_label(ws.cell(row=6, column=1), bold=True)
for i, y in enumerate(YEARS):
    f = (f"={sumifs_dept(y,'Operations')[1:]}"
         f"+{sumifs_dept(y,'CVA')[1:]}"
         f"+{sumifs_dept(y,'Power')[1:]}")
    style_num(ws.cell(row=6, column=2+i, value=f), bold=True)
ws.cell(row=6, column=15, value='=IFERROR((N6/B6)^(1/12)-1,"-")')
style_pct(ws.cell(row=6, column=15), bold=True)

# Row 7: Total
ws.cell(row=7, column=1, value='Total revenue (£)')
style_row_label(ws.cell(row=7, column=1), bold=True)
for i in range(13):
    col = get_column_letter(2+i)
    style_num(ws.cell(row=7, column=2+i, value=f'={col}5+{col}6'), bold=True, fill=LIGHT_GREY)
ws.cell(row=7, column=15, value='=IFERROR((N7/B7)^(1/12)-1,"-")')
style_pct(ws.cell(row=7, column=15), bold=True)

# Row 9-10: Mix %
ws.cell(row=9, column=1, value='Software % of total')
style_row_label(ws.cell(row=9, column=1))
for i in range(13):
    col = get_column_letter(2+i)
    style_pct(ws.cell(row=9, column=2+i, value=f'=IFERROR({col}5/{col}7,"-")'))
ws.cell(row=10, column=1, value='Services % of total')
style_row_label(ws.cell(row=10, column=1))
for i in range(13):
    col = get_column_letter(2+i)
    style_pct(ws.cell(row=10, column=2+i, value=f'=IFERROR({col}6/{col}7,"-")'))

# Row 12-13: YoY growth
ws.cell(row=12, column=1, value='Software YoY growth')
style_row_label(ws.cell(row=12, column=1))
ws.cell(row=12, column=2, value='-').alignment = Alignment(horizontal='right')
for i in range(1, 13):
    col = get_column_letter(2+i); prev = get_column_letter(1+i)
    style_pct(ws.cell(row=12, column=2+i, value=f'=IFERROR({col}5/{prev}5-1,"-")'))
ws.cell(row=13, column=1, value='Services YoY growth')
style_row_label(ws.cell(row=13, column=1))
ws.cell(row=13, column=2, value='-').alignment = Alignment(horizontal='right')
for i in range(1, 13):
    col = get_column_letter(2+i); prev = get_column_letter(1+i)
    style_pct(ws.cell(row=13, column=2+i, value=f'=IFERROR({col}6/{prev}6-1,"-")'))

# Row 15-16: # active revenue lines
ws.cell(row=15, column=1, value='# Software revenue lines')
style_row_label(ws.cell(row=15, column=1))
for i, y in enumerate(YEARS):
    yc = src_year_col(y)
    f = (f'=COUNTIFS({SRC}!$B${SRC_FIRST}:$B${SRC_LAST},"Software",'
         f'{SRC}!${yc}${SRC_FIRST}:${yc}${SRC_LAST},">0")')
    style_num(ws.cell(row=15, column=2+i, value=f))
ws.cell(row=16, column=1, value='# Services revenue lines')
style_row_label(ws.cell(row=16, column=1))
for i, y in enumerate(YEARS):
    yc = src_year_col(y)
    f = (f'=COUNTIFS({SRC}!$B${SRC_FIRST}:$B${SRC_LAST},"<>Software",'
         f'{SRC}!${yc}${SRC_FIRST}:${yc}${SRC_LAST},">0")')
    style_num(ws.cell(row=16, column=2+i, value=f))

# Conditional fmt on YoY rows
for r in (12, 13):
    ws.conditional_formatting.add(f'C{r}:N{r}',
        CellIsRule(operator='greaterThan', formula=['0'],
                   fill=PatternFill('solid', fgColor='FFD9F2D9')))
    ws.conditional_formatting.add(f'C{r}:N{r}',
        CellIsRule(operator='lessThan', formula=['0'],
                   fill=PatternFill('solid', fgColor='FFF8D7DA')))

widen(ws, first_col_width=32, year_width=13)
ws.column_dimensions['O'].width = 16
ws.freeze_panes = 'B5'

# =============== Revenue by Department ===============
ws = wb.create_sheet('By Department')
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'Revenue by Department (£ GBP)'
ws['A1'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)
ws.cell(row=3, column=1, value='Department')
style_header(ws.cell(row=3, column=1))
add_year_headers(ws, 3, 2)
style_header(ws.cell(row=3, column=15, value='CAGR FY14-FY26'))

# Order: Software first, then services depts
ordered_depts = ['Software', 'Operations', 'CVA', 'Power']
start = 4
for ridx, d in enumerate(ordered_depts):
    r = start + ridx
    ws.cell(row=r, column=1, value=d)
    style_row_label(ws.cell(row=r, column=1))
    for i, y in enumerate(YEARS):
        style_num(ws.cell(row=r, column=2+i, value=sumifs_dept(y, d)))
    ws.cell(row=r, column=15, value=f'=IFERROR((N{r}/B{r})^(1/12)-1,"-")')
    style_pct(ws.cell(row=r, column=15))

# Total row
tot_r = start + len(ordered_depts)
ws.cell(row=tot_r, column=1, value='Total')
style_row_label(ws.cell(row=tot_r, column=1), bold=True)
for i in range(13):
    col = get_column_letter(2+i)
    style_num(ws.cell(row=tot_r, column=2+i,
        value=f'=SUM({col}{start}:{col}{tot_r-1})'), bold=True, fill=LIGHT_GREY)
ws.cell(row=tot_r, column=15,
        value=f'=IFERROR((N{tot_r}/B{tot_r})^(1/12)-1,"-")')
style_pct(ws.cell(row=tot_r, column=15), bold=True)

# Mix % section
mix_start = tot_r + 2
ws.cell(row=mix_start, column=1, value='% Mix').font = Font(name=ARIAL, size=11, bold=True, color=NAVY)
for ridx, d in enumerate(ordered_depts):
    r = mix_start + 1 + ridx
    ws.cell(row=r, column=1, value=d)
    style_row_label(ws.cell(row=r, column=1))
    for i in range(13):
        col = get_column_letter(2+i)
        style_pct(ws.cell(row=r, column=2+i,
            value=f'=IFERROR({col}{start+ridx}/{col}{tot_r},"-")'))

widen(ws, first_col_width=22, year_width=13)
ws.column_dimensions['O'].width = 16
ws.freeze_panes = 'B4'

# =============== By Product ===============
ws = wb.create_sheet('By Product')
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'Revenue by Product (£ GBP)'
ws['A1'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)
ws.cell(row=3, column=1, value='Product')
style_header(ws.cell(row=3, column=1))
add_year_headers(ws, 3, 2)
style_header(ws.cell(row=3, column=15, value='CAGR FY14-FY26'))
style_header(ws.cell(row=3, column=16, value='% of FY26'))

start = 4
for ridx, p in enumerate(PRODS):
    r = start + ridx
    ws.cell(row=r, column=1, value=p)
    style_row_label(ws.cell(row=r, column=1))
    for i, y in enumerate(YEARS):
        f = src_sumifs(y, {'C': f'"{p}"'})
        style_num(ws.cell(row=r, column=2+i, value=f))
    ws.cell(row=r, column=15, value=f'=IFERROR((N{r}/B{r})^(1/12)-1,"-")')
    style_pct(ws.cell(row=r, column=15))

tot_r = start + len(PRODS)
ws.cell(row=tot_r, column=1, value='Total')
style_row_label(ws.cell(row=tot_r, column=1), bold=True)
for i in range(13):
    col = get_column_letter(2+i)
    style_num(ws.cell(row=tot_r, column=2+i,
        value=f'=SUM({col}{start}:{col}{tot_r-1})'), bold=True, fill=LIGHT_GREY)
ws.cell(row=tot_r, column=15, value=f'=IFERROR((N{tot_r}/B{tot_r})^(1/12)-1,"-")')
style_pct(ws.cell(row=tot_r, column=15), bold=True)

# % of FY26 column for each product
for ridx in range(len(PRODS)):
    r = start + ridx
    ws.cell(row=r, column=16, value=f'=IFERROR(N{r}/N${tot_r},"-")')
    style_pct(ws.cell(row=r, column=16))
ws.cell(row=tot_r, column=16, value=f'=IFERROR(N{tot_r}/N{tot_r},"-")')
style_pct(ws.cell(row=tot_r, column=16), bold=True)

widen(ws, first_col_width=22, year_width=13)
ws.column_dimensions['O'].width = 16
ws.column_dimensions['P'].width = 12
ws.freeze_panes = 'B4'

# =============== By Geography ===============
ws = wb.create_sheet('By Geography')
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'Revenue by Country (£ GBP)'
ws['A1'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)
ws.cell(row=3, column=1, value='Country')
style_header(ws.cell(row=3, column=1))
add_year_headers(ws, 3, 2)
style_header(ws.cell(row=3, column=15, value='CAGR FY14-FY26'))
style_header(ws.cell(row=3, column=16, value='% of FY26'))

start = 4
for ridx, c in enumerate(COUNTRIES):
    r = start + ridx
    ws.cell(row=r, column=1, value=c)
    style_row_label(ws.cell(row=r, column=1))
    for i, y in enumerate(YEARS):
        f = src_sumifs(y, {'D': f'"{c}"'})
        style_num(ws.cell(row=r, column=2+i, value=f))
    ws.cell(row=r, column=15, value=f'=IFERROR((N{r}/B{r})^(1/12)-1,"-")')
    style_pct(ws.cell(row=r, column=15))

tot_r = start + len(COUNTRIES)
ws.cell(row=tot_r, column=1, value='Total')
style_row_label(ws.cell(row=tot_r, column=1), bold=True)
for i in range(13):
    col = get_column_letter(2+i)
    style_num(ws.cell(row=tot_r, column=2+i,
        value=f'=SUM({col}{start}:{col}{tot_r-1})'), bold=True, fill=LIGHT_GREY)
ws.cell(row=tot_r, column=15, value=f'=IFERROR((N{tot_r}/B{tot_r})^(1/12)-1,"-")')
style_pct(ws.cell(row=tot_r, column=15), bold=True)
for ridx in range(len(COUNTRIES)):
    r = start + ridx
    ws.cell(row=r, column=16, value=f'=IFERROR(N{r}/N${tot_r},"-")')
    style_pct(ws.cell(row=r, column=16))

widen(ws, first_col_width=22, year_width=13)
ws.column_dimensions['O'].width = 16
ws.column_dimensions['P'].width = 12
ws.freeze_panes = 'B4'

# =============== Helper_Clients (per-client per-year revenue) ===============
# Lists every unique client (label only is hardcoded; values are formulas)
HELP = 'Helper_Clients'
ws = wb.create_sheet(HELP)
ws.sheet_properties.tabColor = 'FFBFBFBF'
ws.sheet_state = 'hidden'
ws['A1'] = 'Helper tab — derived from Source_Evolution unique clients (labels only). All revenue = formulas.'
ws['A1'].font = Font(name=ARIAL, size=9, italic=True, color='FF666666')
hdrs = ['Client', 'Primary Dept', 'Primary Country', 'Cohort year (first FY > 0)'] + [f'FY{y}A' for y in YEARS] + ['Total FY14-FY26', 'Latest FY26', 'Software flag']
for j, h in enumerate(hdrs, start=1):
    style_header(ws.cell(row=2, column=j, value=h))

clients_sorted = sorted(CLIENTS.keys())
H_FIRST = 3
H_LAST = H_FIRST + len(clients_sorted) - 1
for i, cl in enumerate(clients_sorted):
    r = H_FIRST + i
    meta = CLIENTS[cl]
    ws.cell(row=r, column=1, value=cl)
    ws.cell(row=r, column=2, value=meta['primary_dept'])
    ws.cell(row=r, column=3, value=meta['primary_country'])
    ws.cell(row=r, column=4, value=meta['first'] if meta['first'] else '')
    for k, y in enumerate(YEARS):
        yc = src_year_col(y)
        f = (f'=SUMIFS({SRC}!${yc}${SRC_FIRST}:${yc}${SRC_LAST},'
             f'{SRC}!$A${SRC_FIRST}:$A${SRC_LAST},$A{r})')
        ws.cell(row=r, column=5+k, value=f).number_format = '#,##0'
    # Total FY14-FY26 (col R = 18)
    ws.cell(row=r, column=18,
            value=f'=SUM(E{r}:Q{r})').number_format = '#,##0'
    # Latest FY26 (col S = 19)
    ws.cell(row=r, column=19, value=f'=Q{r}').number_format = '#,##0'
    # Software flag (col T = 20)
    ws.cell(row=r, column=20, value=f'=IF(B{r}="Software",1,0)')
    # # active revenue lines per year (cols U..AG = 21..33)
    for k, y in enumerate(YEARS):
        yc = src_year_col(y)
        f = (f'=SUMPRODUCT(({SRC}!$A${SRC_FIRST}:$A${SRC_LAST}=$A{r})*'
             f'({SRC}!${yc}${SRC_FIRST}:${yc}${SRC_LAST}>0))')
        ws.cell(row=r, column=21+k, value=f).number_format = '0'

print(f'Helper_Clients: rows {H_FIRST}..{H_LAST} ({len(clients_sorted)} clients)')

# =============== Client Concentration ===============
ws = wb.create_sheet('Client Concentration')
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'Client Concentration — based on FY26A revenue (£ GBP)'
ws['A1'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)

ws.cell(row=3, column=1, value='Concentration metric')
style_header(ws.cell(row=3, column=1))
add_year_headers(ws, 3, 2)

H_RNG_FY = lambda y: f'{HELP}!${src_year_col(y)}${H_FIRST}:${src_year_col(y)}${H_LAST}'

# # Active clients
ws.cell(row=4, column=1, value='# Active clients (rev > 0)')
style_row_label(ws.cell(row=4, column=1), bold=True)
for i, y in enumerate(YEARS):
    f = f'=COUNTIF({H_RNG_FY(y)},">0")'
    style_num(ws.cell(row=4, column=2+i, value=f), bold=True)

# Top N share rows: 1, 5, 10, 20, 50
def topn_share_formula(n, year):
    rng = H_RNG_FY(year)
    # SUMPRODUCT(LARGE(rng,ROW(INDIRECT("1:n")))) / SUM(rng)
    return (f'=IFERROR(SUMPRODUCT(LARGE({rng},ROW(INDIRECT("1:{n}"))))'
            f'/SUM({rng}),"-")')

row_specs = [
    (5, 'Top 1 client share', 1),
    (6, 'Top 5 clients share', 5),
    (7, 'Top 10 clients share', 10),
    (8, 'Top 20 clients share', 20),
    (9, 'Top 50 clients share', 50),
]
for r, label, n in row_specs:
    ws.cell(row=r, column=1, value=label)
    style_row_label(ws.cell(row=r, column=1))
    for i, y in enumerate(YEARS):
        style_pct(ws.cell(row=r, column=2+i, value=topn_share_formula(n, y)))

widen(ws, first_col_width=32, year_width=13)
ws.freeze_panes = 'B4'

# Top 20 clients table (FY26A)
start_t = 12
ws.cell(row=start_t, column=1, value='Top 20 clients by FY26A revenue').font = Font(name=ARIAL, size=11, bold=True, color=NAVY)
hdrs = ['Rank', 'Client', 'Primary Dept', 'Primary Country', 'FY26A revenue (£)', '% of total FY26A']
for j, h in enumerate(hdrs, start=1):
    style_header(ws.cell(row=start_t+1, column=j, value=h))

q26 = src_year_col(2026)
H_FY26 = f'{HELP}!${q26}${H_FIRST}:${q26}${H_LAST}'
H_NAME = f'{HELP}!$A${H_FIRST}:$A${H_LAST}'
H_DEPT = f'{HELP}!$B${H_FIRST}:$B${H_LAST}'
H_CTRY = f'{HELP}!$C${H_FIRST}:$C${H_LAST}'

for k in range(1, 21):
    r = start_t + 1 + k
    ws.cell(row=r, column=1, value=k)
    style_num(ws.cell(row=r, column=1), fmt='0')
    # FY26 value via LARGE
    ws.cell(row=r, column=5, value=f'=IFERROR(LARGE({H_FY26},{k}),"-")')
    style_num(ws.cell(row=r, column=5))
    # Client name via INDEX/MATCH
    ws.cell(row=r, column=2,
        value=f'=IFERROR(INDEX({H_NAME},MATCH(LARGE({H_FY26},{k}),{H_FY26},0)),"-")')
    style_row_label(ws.cell(row=r, column=2))
    ws.cell(row=r, column=3,
        value=f'=IFERROR(INDEX({H_DEPT},MATCH(LARGE({H_FY26},{k}),{H_FY26},0)),"-")')
    style_row_label(ws.cell(row=r, column=3))
    ws.cell(row=r, column=4,
        value=f'=IFERROR(INDEX({H_CTRY},MATCH(LARGE({H_FY26},{k}),{H_FY26},0)),"-")')
    style_row_label(ws.cell(row=r, column=4))
    ws.cell(row=r, column=6, value=f'=IFERROR(E{r}/SUM({H_FY26}),"-")')
    style_pct(ws.cell(row=r, column=6))

ws.column_dimensions['A'].width = 8
ws.column_dimensions['B'].width = 30
ws.column_dimensions['C'].width = 16
ws.column_dimensions['D'].width = 18
ws.column_dimensions['E'].width = 18
ws.column_dimensions['F'].width = 18

# =============== Cohort Analysis ===============
ws = wb.create_sheet('Cohort Analysis')
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'Cohort Analysis — Revenue retention by acquisition vintage (£ GBP)'
ws['A1'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)
ws['A2'] = 'Cohort = first FY where client had revenue > 0. Cohort year hardcoded in Helper_Clients (col D); revenue = formulas.'
ws['A2'].font = Font(name=ARIAL, size=9, italic=True, color='FF666666')

ws.cell(row=4, column=1, value='Cohort vintage')
style_header(ws.cell(row=4, column=1))
style_header(ws.cell(row=4, column=2, value='# Clients'))
add_year_headers(ws, 4, 3)  # cols 3..15

H_COHORT = f'{HELP}!$D${H_FIRST}:$D${H_LAST}'

start = 5
for ridx, vintage in enumerate(YEARS):
    r = start + ridx
    ws.cell(row=r, column=1, value=f'FY{vintage}')
    style_row_label(ws.cell(row=r, column=1), bold=True)
    # # clients in this cohort
    ws.cell(row=r, column=2, value=f'=COUNTIF({H_COHORT},{vintage})')
    style_num(ws.cell(row=r, column=2), bold=True)
    for i, y in enumerate(YEARS):
        rng_y = H_RNG_FY(y)
        if y < vintage:
            ws.cell(row=r, column=3+i, value='-').alignment = Alignment(horizontal='right')
        else:
            f = f'=SUMIFS({rng_y},{H_COHORT},{vintage})'
            style_num(ws.cell(row=r, column=3+i, value=f))

# Total row
tot_r = start + len(YEARS)
ws.cell(row=tot_r, column=1, value='Total')
style_row_label(ws.cell(row=tot_r, column=1), bold=True)
ws.cell(row=tot_r, column=2, value=f'=SUM(B{start}:B{tot_r-1})')
style_num(ws.cell(row=tot_r, column=2), bold=True, fill=LIGHT_GREY)
for i in range(13):
    col = get_column_letter(3+i)
    style_num(ws.cell(row=tot_r, column=3+i,
        value=f'=SUM({col}{start}:{col}{tot_r-1})'), bold=True, fill=LIGHT_GREY)

# Indexed retention section (each cohort indexed to its first year)
ix_start = tot_r + 3
ws.cell(row=ix_start, column=1, value='Cohort revenue indexed to vintage year (= 100)').font = Font(name=ARIAL, size=11, bold=True, color=NAVY)
ws.cell(row=ix_start+1, column=1, value='Cohort vintage')
style_header(ws.cell(row=ix_start+1, column=1))
add_year_headers(ws, ix_start+1, 3)

for ridx, vintage in enumerate(YEARS):
    r_src = start + ridx        # row in absolute table
    r = ix_start + 2 + ridx
    ws.cell(row=r, column=1, value=f'FY{vintage}')
    style_row_label(ws.cell(row=r, column=1), bold=True)
    base_col = get_column_letter(3 + (vintage-2014))   # vintage column in cols 3..15
    for i, y in enumerate(YEARS):
        col = get_column_letter(3+i)
        if y < vintage:
            ws.cell(row=r, column=3+i, value='-').alignment = Alignment(horizontal='right')
        else:
            f = f'=IFERROR({col}{r_src}/{base_col}{r_src}*100,"-")'
            style_num(ws.cell(row=r, column=3+i, value=f), fmt='0')

ws.column_dimensions['A'].width = 16
ws.column_dimensions['B'].width = 12
for i in range(13):
    ws.column_dimensions[get_column_letter(3+i)].width = 12
ws.freeze_panes = 'C5'

# =============== Client Dynamics ===============
ws = wb.create_sheet('Client Dynamics')
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'Client Dynamics — New / Active / Churned (£ GBP)'
ws['A1'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)
ws['A2'] = 'Active = client with revenue > 0 in the year. New = first FY in this year. Churned = was active in N-1 but not in N.'
ws['A2'].font = Font(name=ARIAL, size=9, italic=True, color='FF666666')

ws.cell(row=4, column=1, value='Metric')
style_header(ws.cell(row=4, column=1))
add_year_headers(ws, 4, 2)

# Row 5: # Active clients
ws.cell(row=5, column=1, value='# Active clients')
style_row_label(ws.cell(row=5, column=1), bold=True)
for i, y in enumerate(YEARS):
    style_num(ws.cell(row=5, column=2+i,
        value=f'=COUNTIF({H_RNG_FY(y)},">0")'), bold=True)

# Row 6: # New clients (cohort = year)
ws.cell(row=6, column=1, value='# New clients')
style_row_label(ws.cell(row=6, column=1))
for i, y in enumerate(YEARS):
    style_num(ws.cell(row=6, column=2+i,
        value=f'=COUNTIF({H_COHORT},{y})'))

# Row 7: # Churned clients (active prev year, not active this year)
ws.cell(row=7, column=1, value='# Churned clients')
style_row_label(ws.cell(row=7, column=1))
ws.cell(row=7, column=2, value='-').alignment = Alignment(horizontal='right')
for i in range(1, 13):
    y_prev = YEARS[i-1]; y_cur = YEARS[i]
    rng_p = H_RNG_FY(y_prev); rng_c = H_RNG_FY(y_cur)
    f = f'=SUMPRODUCT(({rng_p}>0)*({rng_c}=0))'
    style_num(ws.cell(row=7, column=2+i, value=f))

# Row 8: Net adds
ws.cell(row=8, column=1, value='Net adds (New - Churned)')
style_row_label(ws.cell(row=8, column=1))
ws.cell(row=8, column=2, value='-').alignment = Alignment(horizontal='right')
for i in range(1, 13):
    col = get_column_letter(2+i)
    style_num(ws.cell(row=8, column=2+i, value=f'={col}6-{col}7'))

# Row 10: Logo retention %
ws.cell(row=10, column=1, value='Logo retention %')
style_row_label(ws.cell(row=10, column=1))
ws.cell(row=10, column=2, value='-').alignment = Alignment(horizontal='right')
for i in range(1, 13):
    col = get_column_letter(2+i); prev = get_column_letter(1+i)
    f = f'=IFERROR(({col}5-{col}6)/{prev}5,"-")'
    style_pct(ws.cell(row=10, column=2+i, value=f))

# Row 11: GRR (revenue retention from same clients, no expansion)
ws.cell(row=11, column=1, value='GRR — Same client base (£)')
style_row_label(ws.cell(row=11, column=1))
ws.cell(row=11, column=2, value='-').alignment = Alignment(horizontal='right')
for i in range(1, 13):
    y_prev = YEARS[i-1]; y_cur = YEARS[i]
    rng_p = H_RNG_FY(y_prev); rng_c = H_RNG_FY(y_cur)
    # min(prev, cur) summed only over clients active in prev → SUMPRODUCT
    f = (f'=IFERROR(SUMPRODUCT(({rng_p}>0)*'
         f'IF({rng_c}<{rng_p},{rng_c},{rng_p}))/SUMIF({rng_p},">0"),"-")')
    style_pct(ws.cell(row=11, column=2+i, value=f))

# Row 12: NRR (incl expansion)
ws.cell(row=12, column=1, value='NRR — Same client base, with expansion')
style_row_label(ws.cell(row=12, column=1))
ws.cell(row=12, column=2, value='-').alignment = Alignment(horizontal='right')
for i in range(1, 13):
    y_prev = YEARS[i-1]; y_cur = YEARS[i]
    rng_p = H_RNG_FY(y_prev); rng_c = H_RNG_FY(y_cur)
    f = (f'=IFERROR(SUMPRODUCT(({rng_p}>0)*{rng_c})'
         f'/SUMIF({rng_p},">0"),"-")')
    style_pct(ws.cell(row=12, column=2+i, value=f))

# Row 14: ARPC (average revenue per client)
ws.cell(row=14, column=1, value='ARPC — Avg revenue per client (£)')
style_row_label(ws.cell(row=14, column=1))
for i, y in enumerate(YEARS):
    rng = H_RNG_FY(y)
    f = f'=IFERROR(SUM({rng})/COUNTIF({rng},">0"),"-")'
    style_num(ws.cell(row=14, column=2+i, value=f))

widen(ws, first_col_width=42, year_width=13)
ws.freeze_panes = 'B5'

# =============== Cross-sell ===============
ws = wb.create_sheet('Cross-sell')
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'Cross-sell — Product breadth per client (£ GBP)'
ws['A1'].font = Font(name=ARIAL, size=14, bold=True, color=NAVY)
ws['A2'] = '"Lines" = active revenue lines per client (proxy for product/country breadth, 1 line = unique product × country combo).'
ws['A2'].font = Font(name=ARIAL, size=9, italic=True, color='FF666666')

ws.cell(row=4, column=1, value='Metric')
style_header(ws.cell(row=4, column=1))
add_year_headers(ws, 4, 2)

# Helper ranges for # lines per year (cols U..AG in Helper_Clients = letters U..AG)
def H_LINES(year):
    col = get_column_letter(21 + (year-2014))
    return f'{HELP}!${col}${H_FIRST}:${col}${H_LAST}'

# Row 5: Avg lines per active client
ws.cell(row=5, column=1, value='Avg # lines per active client')
style_row_label(ws.cell(row=5, column=1), bold=True)
for i, y in enumerate(YEARS):
    rng_lines = H_LINES(y); rng_rev = H_RNG_FY(y)
    f = f'=IFERROR(SUM({rng_lines})/COUNTIF({rng_rev},">0"),"-")'
    style_num(ws.cell(row=5, column=2+i, value=f), fmt='0.00', bold=True)

# Row 7: # Mono-line clients (exactly 1)
ws.cell(row=7, column=1, value='# Mono-line clients (1 line)')
style_row_label(ws.cell(row=7, column=1))
for i, y in enumerate(YEARS):
    f = f'=COUNTIF({H_LINES(y)},1)'
    style_num(ws.cell(row=7, column=2+i, value=f))

# Row 8: # Multi-line clients (>=2)
ws.cell(row=8, column=1, value='# Multi-line clients (>=2)')
style_row_label(ws.cell(row=8, column=1))
for i, y in enumerate(YEARS):
    f = f'=COUNTIF({H_LINES(y)},">=2")'
    style_num(ws.cell(row=8, column=2+i, value=f))

# Row 9: % Multi-line
ws.cell(row=9, column=1, value='% Multi-line clients')
style_row_label(ws.cell(row=9, column=1))
for i in range(13):
    col = get_column_letter(2+i)
    style_pct(ws.cell(row=9, column=2+i,
        value=f'=IFERROR({col}8/({col}7+{col}8),"-")'))

# Row 11: Revenue from mono-line clients
ws.cell(row=11, column=1, value='Revenue from mono-line clients (£)')
style_row_label(ws.cell(row=11, column=1))
for i, y in enumerate(YEARS):
    rng_lines = H_LINES(y); rng_rev = H_RNG_FY(y)
    f = f'=SUMIFS({rng_rev},{rng_lines},1)'
    style_num(ws.cell(row=11, column=2+i, value=f))

# Row 12: Revenue from multi-line clients
ws.cell(row=12, column=1, value='Revenue from multi-line clients (£)')
style_row_label(ws.cell(row=12, column=1))
for i, y in enumerate(YEARS):
    rng_lines = H_LINES(y); rng_rev = H_RNG_FY(y)
    f = f'=SUMIFS({rng_rev},{rng_lines},">=2")'
    style_num(ws.cell(row=12, column=2+i, value=f))

# Row 13: % Revenue from multi-line
ws.cell(row=13, column=1, value='% Revenue from multi-line clients')
style_row_label(ws.cell(row=13, column=1), bold=True)
for i in range(13):
    col = get_column_letter(2+i)
    style_pct(ws.cell(row=13, column=2+i,
        value=f'=IFERROR({col}12/({col}11+{col}12),"-")'), bold=True)

# Distribution block
dist_start = 16
ws.cell(row=dist_start, column=1, value='Distribution of clients by # lines').font = Font(name=ARIAL, size=11, bold=True, color=NAVY)
ws.cell(row=dist_start+1, column=1, value='# lines')
style_header(ws.cell(row=dist_start+1, column=1))
add_year_headers(ws, dist_start+1, 2)
buckets = [(1,'1'),(2,'2'),(3,'3'),(4,'4+')]
for k,(b,label) in enumerate(buckets):
    r = dist_start + 2 + k
    ws.cell(row=r, column=1, value=label)
    style_row_label(ws.cell(row=r, column=1))
    for i, y in enumerate(YEARS):
        if label == '4+':
            f = f'=COUNTIF({H_LINES(y)},">=4")'
        else:
            f = f'=COUNTIF({H_LINES(y)},{b})'
        style_num(ws.cell(row=r, column=2+i, value=f))

widen(ws, first_col_width=38, year_width=13)
ws.freeze_panes = 'B5'

# =============== Summary ===============
ws = wb.create_sheet('Summary', 0)  # first tab
ws.sheet_properties.tabColor = 'FF173B57'
ws['A1'] = 'PROJECT DARWIN — Datacube Summary'
ws['A1'].font = Font(name=ARIAL, size=18, bold=True, color=NAVY)
ws['A2'] = 'Currency: £ GBP — Source: GMSL_Revenue_Lines_Clip.xlsx (5 Apr 2026) — All FY actuals'
ws['A2'].font = Font(name=ARIAL, size=10, italic=True, color='FF666666')

ws.cell(row=4, column=1, value='Key metric')
style_header(ws.cell(row=4, column=1))
add_year_headers(ws, 4, 2)

# Total revenue (link to Revenue Overview row 4)
def link_overview(label, src_row, fmt='num', bold=False):
    return label, src_row, fmt, bold

key_rows = [
    ('Total revenue (£)',          "='Revenue Overview'!", 4,  'num',  True),
    ('YoY growth',                 "='Revenue Overview'!", 5,  'pct',  False),
    ('Indexed (FY14 = 100)',       "='Revenue Overview'!", 6,  'idx',  False),
]
r = 5
for label, prefix, src_r, fmt, bold in key_rows:
    ws.cell(row=r, column=1, value=label)
    style_row_label(ws.cell(row=r, column=1), bold=bold)
    for i in range(13):
        col = get_column_letter(2+i)
        cell = ws.cell(row=r, column=2+i, value=f"{prefix}{col}{src_r}")
        if fmt == 'num': style_num(cell, bold=bold)
        elif fmt == 'pct': style_pct(cell)
        elif fmt == 'idx': style_num(cell, fmt='0')
    r += 1

r += 1
# Software vs Services block
ws.cell(row=r, column=1, value='Software vs Services').font = Font(name=ARIAL, size=11, bold=True, color=NAVY)
r += 1
sv_rows = [
    ('Software revenue (£)',  "='Software vs Services'!", 5,  'num',  True),
    ('Services revenue (£)',  "='Software vs Services'!", 6,  'num',  True),
    ('Software % of total',   "='Software vs Services'!", 9,  'pct',  False),
    ('Software YoY growth',   "='Software vs Services'!", 12, 'pct',  False),
    ('Services YoY growth',   "='Software vs Services'!", 13, 'pct',  False),
]
for label, prefix, src_r, fmt, bold in sv_rows:
    ws.cell(row=r, column=1, value=label)
    style_row_label(ws.cell(row=r, column=1), bold=bold)
    for i in range(13):
        col = get_column_letter(2+i)
        cell = ws.cell(row=r, column=2+i, value=f"{prefix}{col}{src_r}")
        if fmt == 'num': style_num(cell, bold=bold)
        else: style_pct(cell)
    r += 1

r += 1
ws.cell(row=r, column=1, value='Client base').font = Font(name=ARIAL, size=11, bold=True, color=NAVY)
r += 1
cb_rows = [
    ('# Active clients',         "='Client Dynamics'!", 5,  'num',  True),
    ('# New clients',            "='Client Dynamics'!", 6,  'num',  False),
    ('# Churned clients',        "='Client Dynamics'!", 7,  'num',  False),
    ('Logo retention %',         "='Client Dynamics'!", 10, 'pct',  False),
    ('GRR — same client base',   "='Client Dynamics'!", 11, 'pct',  False),
    ('NRR — w/ expansion',       "='Client Dynamics'!", 12, 'pct',  False),
    ('ARPC (£)',                 "='Client Dynamics'!", 14, 'num',  False),
]
for label, prefix, src_r, fmt, bold in cb_rows:
    ws.cell(row=r, column=1, value=label)
    style_row_label(ws.cell(row=r, column=1), bold=bold)
    for i in range(13):
        col = get_column_letter(2+i)
        cell = ws.cell(row=r, column=2+i, value=f"{prefix}{col}{src_r}")
        if fmt == 'num': style_num(cell, bold=bold)
        else: style_pct(cell)
    r += 1

r += 1
ws.cell(row=r, column=1, value='Concentration').font = Font(name=ARIAL, size=11, bold=True, color=NAVY)
r += 1
conc_rows = [
    ('Top 1 client share',  "='Client Concentration'!", 5),
    ('Top 5 client share',  "='Client Concentration'!", 6),
    ('Top 10 client share', "='Client Concentration'!", 7),
    ('Top 20 client share', "='Client Concentration'!", 8),
]
for label, prefix, src_r in conc_rows:
    ws.cell(row=r, column=1, value=label)
    style_row_label(ws.cell(row=r, column=1))
    for i in range(13):
        col = get_column_letter(2+i)
        cell = ws.cell(row=r, column=2+i, value=f"{prefix}{col}{src_r}")
        style_pct(cell)
    r += 1

widen(ws, first_col_width=38, year_width=13)
ws.freeze_panes = 'B5'

# Reorder tabs: Summary, Revenue Overview, Software vs Services, By Department, By Product,
# By Geography, Cohort Analysis, Client Dynamics, Client Concentration, Helper_Clients, Source_Evolution, Source_Info
desired = ['Summary','Revenue Overview','Software vs Services','By Department','By Product','By Geography',
           'Cohort Analysis','Client Dynamics','Client Concentration','Cross-sell','Helper_Clients','Source_Evolution','Source_Info']
wb._sheets = [wb[name] for name in desired]

wb.save(OUT)
print('Saved final:', OUT)
print('Tabs:', wb.sheetnames)
