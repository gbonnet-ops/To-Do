from pptx import Presentation
from pptx.util import Pt, Cm
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

DARK_BLUE = RGBColor(0x15, 0x23, 0x4A)
LIGHT_BLUE = RGBColor(0x65, 0xC4, 0xDA)
LIGHT_GREEN = RGBColor(0xB6, 0xCF, 0x2B)
GREEN = RGBColor(0x95, 0xCD, 0x9C)
GREY = RGBColor(0xE5, 0xE5, 0xE5)
DARK_BLUE2 = RGBColor(0x2A, 0x38, 0x5B)
BG_COLOR = RGBColor(0xFA, 0xFA, 0xFA)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
prs = Presentation(); prs.slide_width = Cm(33.867); prs.slide_height = Cm(19.05)

def add_bg(s): s.background.fill.solid(); s.background.fill.fore_color.rgb = BG_COLOR
def add_header(s, sec, title, pn):
    shp = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Cm(0), Cm(0), prs.slide_width, Cm(1.2))
    shp.fill.solid(); shp.fill.fore_color.rgb = DARK_BLUE; shp.line.fill.background()
    p = shp.text_frame.paragraphs[0]; p.text = sec; p.font.color.rgb = WHITE; p.font.size = Pt(9); p.font.bold = True
    r = p.add_run(); r.text = f"    |    {pn}"; r.font.color.rgb = LIGHT_BLUE; r.font.size = Pt(9)
    tx = s.shapes.add_textbox(Cm(1.5), Cm(1.5), Cm(30), Cm(1.5))
    p = tx.text_frame.paragraphs[0]; p.text = title; p.font.size = Pt(18); p.font.bold = True; p.font.color.rgb = DARK_BLUE
def add_footer(s):
    tx = s.shapes.add_textbox(Cm(1), Cm(18), Cm(12), Cm(0.8))
    p = tx.text_frame.paragraphs[0]; p.text = "Strictly Private and Confidential"
    p.font.size = Pt(7); p.font.color.rgb = RGBColor(0x99,0x99,0x99); p.font.italic = True
def add_kpi(s, l, t, w, h, v, lb, c=LIGHT_BLUE):
    shp = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, l, t, w, h)
    shp.fill.solid(); shp.fill.fore_color.rgb = WHITE; shp.line.color.rgb = c; shp.line.width = Pt(1.5)
    tf = shp.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = v; p.font.size = Pt(18); p.font.bold = True; p.font.color.rgb = DARK_BLUE; p.alignment = PP_ALIGN.CENTER
    p2 = tf.add_paragraph(); p2.text = lb; p2.font.size = Pt(8); p2.font.color.rgb = DARK_BLUE2; p2.alignment = PP_ALIGN.CENTER

# ============================================
# SLIDE 29: User workflow
# ============================================
s = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(s)
add_header(s, "Product & Services", "User workflow", 29)

# Workflow steps
steps = [
    ("1", "Day-ahead\nPosition Import", "Position import\nfrom ETRM"),
    ("2", "Automated\nNomination", "To TSOs via\nEdig@s/AS2/AS4"),
    ("3", "Real-time\nMatching", "Matching and\nbalancing display"),
    ("4", "Within-day\nRe-nominations", "Intraday\nadjustments"),
    ("5", "Post-day\nAllocations", "Allocations\nand reporting"),
]
# Arrow timeline
for i, (num, title, desc) in enumerate(steps):
    left = Cm(1.5 + i * 6.3)
    # Step box
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Cm(3.5), Cm(5.5), Cm(4.5))
    box.fill.solid(); box.fill.fore_color.rgb = WHITE
    box.line.color.rgb = LIGHT_BLUE; box.line.width = Pt(1.5)
    # Number circle
    circ = s.shapes.add_shape(MSO_SHAPE.OVAL, left + Cm(2), Cm(3), Cm(1.2), Cm(1.2))
    circ.fill.solid(); circ.fill.fore_color.rgb = LIGHT_BLUE; circ.line.fill.background()
    p = circ.text_frame.paragraphs[0]; p.text = num; p.font.size = Pt(12); p.font.bold = True
    p.font.color.rgb = WHITE; p.alignment = PP_ALIGN.CENTER
    
    tf = box.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = title; p.font.size = Pt(10); p.font.bold = True
    p.font.color.rgb = DARK_BLUE; p.alignment = PP_ALIGN.CENTER; p.space_before = Pt(14)
    p2 = tf.add_paragraph(); p2.text = desc; p2.font.size = Pt(8); p2.font.color.rgb = DARK_BLUE2; p2.alignment = PP_ALIGN.CENTER
    
    # Arrow between steps
    if i < 4:
        arrow = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, left + Cm(5.5), Cm(5.2), Cm(0.8), Cm(0.6))
        arrow.fill.solid(); arrow.fill.fore_color.rgb = DARK_BLUE; arrow.line.fill.background()

# Product screenshots placeholder
note_text = "All supported 24/7/365 from Cambridge control room"
note_box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(1.5), Cm(8.5), Cm(31), Cm(1.2))
note_box.fill.solid(); note_box.fill.fore_color.rgb = DARK_BLUE
note_box.line.fill.background()
p = note_box.text_frame.paragraphs[0]; p.text = note_text
p.font.size = Pt(10); p.font.bold = True; p.font.color.rgb = WHITE; p.alignment = PP_ALIGN.CENTER

# Screenshot placeholders
products_ui = [
    ("CodeRunner", "Nomination screen"),
    ("EuroRunner", "Scheduling dashboard"),
    ("ENOM/ENOM+", "Workflow view"),
    ("PowerTrak", "Power interface"),
    ("Chorus", "Modern SaaS UI"),
]
for i, (prod, desc) in enumerate(products_ui):
    left = Cm(1.5 + i * 6.3)
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Cm(10.2), Cm(5.5), Cm(7.3))
    box.fill.solid(); box.fill.fore_color.rgb = WHITE
    box.line.color.rgb = GREY; box.line.width = Pt(0.75)
    tf = box.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = prod; p.font.size = Pt(10); p.font.bold = True
    p.font.color.rgb = DARK_BLUE; p.alignment = PP_ALIGN.CENTER
    p2 = tf.add_paragraph(); p2.text = desc; p2.font.size = Pt(8); p2.font.color.rgb = DARK_BLUE2; p2.alignment = PP_ALIGN.CENTER
    p3 = tf.add_paragraph(); p3.text = "\n[Anonymised UI\nscreenshot to be\nsourced from\nGMSL management]"
    p3.font.size = Pt(8); p3.font.italic = True; p3.font.color.rgb = RGBColor(0x99,0x99,0x99); p3.alignment = PP_ALIGN.CENTER
add_footer(s)

# ============================================
# SLIDE 31: Client base deep dive - Software
# ============================================
s = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(s)
add_header(s, "Clients & Operations", "Client base deep dive – Software", 31)

# KPIs
kpis = [("£5.9m", "FY26F Software\nRevenue", LIGHT_BLUE), ("100+", "Software\nSubscriptions", LIGHT_GREEN),
        ("1-year", "Contracts, auto-\nrenewal, 3m notice", LIGHT_BLUE), ("£20k-£150k", "Typical annual\ncontract value", LIGHT_GREEN)]
for i, (v, lb, c) in enumerate(kpis):
    add_kpi(s, Cm(1.5+i*8), Cm(3.3), Cm(7.2), Cm(2.5), v, lb, c)

# Revenue breakdown by product
box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(1.5), Cm(6.5), Cm(15), Cm(11))
box.fill.solid(); box.fill.fore_color.rgb = WHITE; box.line.color.rgb = GREY; box.line.width = Pt(0.75)
tf = box.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.text = "Revenue Breakdown by Product (FY26F)"
p.font.size = Pt(12); p.font.bold = True; p.font.color.rgb = DARK_BLUE; p.space_after = Pt(8)
products = [
    ("Chorus & ENOM", "£1,168k"), ("EuroRunner", "£950k"), ("CodeRunner", "£269k"),
    ("PowerTrak", "£1,231k"), ("Hosting", "£1,100k"), ("Message Routing", "£1,221k"),
]
for prod, rev in products:
    p = tf.add_paragraph(); p.space_after = Pt(4)
    r = p.add_run(); r.text = f"{prod}: "; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = DARK_BLUE
    r2 = p.add_run(); r2.text = rev; r2.font.size = Pt(10); r2.font.color.rgb = LIGHT_BLUE; r2.font.bold = True

# Right - Client info & growth
box2 = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(17.5), Cm(6.5), Cm(15), Cm(11))
box2.fill.solid(); box2.fill.fore_color.rgb = WHITE; box2.line.color.rgb = GREY; box2.line.width = Pt(0.75)
tf = box2.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.text = "Client Dynamics & Growth"
p.font.size = Pt(12); p.font.bold = True; p.font.color.rgb = DARK_BLUE; p.space_after = Pt(8)
items = [
    "Long-term subscription-based model with annual inflation indexation",
    "Revenue grown from £12.2m (2017) to £17.6m (FY26F) — c.4.4% CAGR over 9 years",
    "Base fee per product + additional fees for extra markets and connections",
    "Top 5 clients: c.27% of total revenue (£4.8m)",
    "Top 10 clients: c.42% of total revenue (£7.3m)",
    "Remaining 129 clients: £10.2m (58%)",
    "Top clients include Fluxys entities (£1.6m) and CVSL (£1.3m)",
    "Commercial team: 2 managers (ex-operations) + 1 coordinator",
    "Limited marketing spend (£98k FY26F) — niche market driven by reputation",
    "Growth strategy: Chorus & PowerTrak expansion to Spain, Central/Eastern Europe",
]
for item in items:
    p = tf.add_paragraph(); p.text = f"• {item}"; p.font.size = Pt(8); p.font.color.rgb = DARK_BLUE2; p.space_after = Pt(3)
add_footer(s)

# ============================================
# SLIDE 32: Client base deep dive - Operations
# ============================================
s = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(s)
add_header(s, "Clients & Operations", "Client base deep dive – Operations", 32)

# KPIs
kpis = [("£10.2m", "FY26F Operations\nRevenue", LIGHT_BLUE), ("90+", "Operations\nClients", LIGHT_GREEN),
        ("£7.5m", "Shipper Ops\nRevenue", LIGHT_BLUE), ("£2.7m", "TSO Ops\nRevenue", LIGHT_GREEN)]
for i, (v, lb, c) in enumerate(kpis):
    add_kpi(s, Cm(1.5+i*8), Cm(3.3), Cm(7.2), Cm(2.5), v, lb, c)

# Contract structure
box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(1.5), Cm(6.5), Cm(15), Cm(5))
box.fill.solid(); box.fill.fore_color.rgb = WHITE; box.line.color.rgb = LIGHT_BLUE; box.line.width = Pt(1)
tf = box.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.text = "Contract Structure"
p.font.size = Pt(12); p.font.bold = True; p.font.color.rgb = DARK_BLUE; p.space_after = Pt(6)
items = ["Annual fee, invoiced monthly", "1-year initial fixed term → evergreen", "6-month termination notice period",
         "Annual indexation + price re-opener on scope changes"]
for item in items:
    p = tf.add_paragraph(); p.text = f"• {item}"; p.font.size = Pt(9); p.font.color.rgb = DARK_BLUE2; p.space_after = Pt(3)

# Key clients
box2 = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(1.5), Cm(12), Cm(31), Cm(5.5))
box2.fill.solid(); box2.fill.fore_color.rgb = WHITE; box2.line.color.rgb = GREY; box2.line.width = Pt(0.75)
tf = box2.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.text = "Key Operations Clients"
p.font.size = Pt(12); p.font.bold = True; p.font.color.rgb = DARK_BLUE; p.space_after = Pt(6)

# Client grid - 4 columns
clients_row1 = "Shell  •  BP  •  TotalEnergies  •  Vitol  •  Trafigura  •  Centrica  •  ExxonMobil"
clients_row2 = "Glencore  •  Mercuria  •  Gunvor  •  Koch  •  Chevron  •  SEFE  •  Macquarie"
clients_row3 = "Morgan Stanley  •  Goldman Sachs  •  JP Morgan  •  Citigroup  •  Natixis  •  70+ others"
for row in [clients_row1, clients_row2, clients_row3]:
    p = tf.add_paragraph(); p.text = row; p.font.size = Pt(9); p.font.color.rgb = DARK_BLUE2
    p.alignment = PP_ALIGN.CENTER; p.space_after = Pt(4)

# Right side additional info
box3 = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(17.5), Cm(6.5), Cm(15), Cm(5))
box3.fill.solid(); box3.fill.fore_color.rgb = WHITE; box3.line.color.rgb = LIGHT_GREEN; box3.line.width = Pt(1)
tf = box3.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.text = "Service Delivery Model"
p.font.size = Pt(12); p.font.bold = True; p.font.color.rgb = DARK_BLUE; p.space_after = Pt(6)
items = ["24/7/365 dispatching from Cambridge control room", "Dedicated TSO ops team (physically separate for compliance)",
         "Shipper ops: nominations, scheduling, balancing, re-nominations", "Post-day allocations and regulatory reporting"]
for item in items:
    p = tf.add_paragraph(); p.text = f"• {item}"; p.font.size = Pt(9); p.font.color.rgb = DARK_BLUE2; p.space_after = Pt(3)

add_footer(s)

prs.save("/tmp/darwin_slides_batch5.pptx")
print("Batch 5 saved: Slides 29, 31, 32")
