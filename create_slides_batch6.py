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

# ============================================
# SLIDE 33: Switching costs & competitive moat
# ============================================
s = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(s)
add_header(s, "Clients & Operations", "Switching costs & competitive moat analysis", 33)

moats = [
    ("Integration Depth", LIGHT_BLUE, [
        "200+ counterparties via MessageRouter",
        "Interfaces with TSOs, SSOs, LNG operators and exchanges",
        "AS2, AS4, FTPS, SFTP and web services protocols",
        "Core workflows where errors carry direct financial and regulatory consequences",
    ]),
    ("Regulatory Barriers", LIGHT_GREEN, [
        "Each TSO/SSO has its own protocols, deadlines and format requirements",
        "B2B connections: 170+ market operators with varied Edig@s and AS4 implementations",
        "Cumbersome processes and TSO-specific requirements",
        "Bespoke arrangements for each connection",
    ]),
    ("Data Lock-in", LIGHT_BLUE, [
        "Client-specific configurations built over years",
        "Portfolio structures, nomination templates, matching rules",
        "Trading system integrations",
        "Transition increases operational error risk in financially penalised markets",
    ]),
    ("Staff & Knowledge", LIGHT_GREEN, [
        "Contract value (£20k-£150k/yr) vs switching cost (retraining, rebuilding TSO connections, re-certifying)",
        "30 years of accumulated specialised knowledge",
        "Cost of switching far exceeds annual fee — structural barrier to entry",
    ]),
    ("Plug & Play Deployment", GREEN, [
        "Quick software setup via MessageRouter",
        "24/7 ops onboarding: training on client portfolios + TSO connectivity",
        "Requires specialised energy market knowledge built over decades",
    ]),
]

for i, (title, color, items) in enumerate(moats):
    col = i % 3
    row = i // 3
    left = Cm(1.5 + col * 10.5)
    top = Cm(3.3 + row * 7.5)
    h = Cm(6.8) if row == 0 else Cm(6.5)
    
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Cm(9.8), h)
    box.fill.solid(); box.fill.fore_color.rgb = WHITE
    box.line.color.rgb = color; box.line.width = Pt(1.5)
    # Header
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, Cm(9.8), Cm(1))
    bar.fill.solid(); bar.fill.fore_color.rgb = color; bar.line.fill.background()
    p = bar.text_frame.paragraphs[0]; p.text = title
    p.font.size = Pt(10); p.font.bold = True; p.font.color.rgb = WHITE; p.alignment = PP_ALIGN.CENTER
    
    tf = box.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.space_before = Pt(16)
    for j, item in enumerate(items):
        if j == 0:
            p.text = f"• {item}"; p.font.size = Pt(8); p.font.color.rgb = DARK_BLUE2; p.space_after = Pt(3)
        else:
            px = tf.add_paragraph(); px.text = f"• {item}"; px.font.size = Pt(8); px.font.color.rgb = DARK_BLUE2; px.space_after = Pt(3)
add_footer(s)

# ============================================
# SLIDE 35: Management team
# ============================================
s = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(s)
add_header(s, "Team & organisation", "Management team", 35)

sub = s.shapes.add_textbox(Cm(1.5), Cm(3), Cm(30), Cm(0.8))
p = sub.text_frame.paragraphs[0]; p.text = "Experienced and stable leadership team — most members with 15-20+ years tenure at GMSL"
p.font.size = Pt(10); p.font.italic = True; p.font.color.rgb = DARK_BLUE2

team = [
    ("Steven De Ranter", "CEO & Director", "MD of GMSL since 2023, MD of Interconnector Ltd since 2018. Prior M&A and business development at Fluxys. Services GMSL c.1 day/week via management services agreement"),
    ("George Wych", "COO & Director", "Day-to-day operational leadership of GMSL. Long tenure with the company"),
    ("David Baldwin", "IT & Software Dev Manager", "Leads 40-person IT department (20 developers, 11 product owners, 9 testers, 4 cloud engineers)"),
    ("Colin Saward", "Operations Manager", "Manages 60-person 24/7 operations team (shipper ops, TSO ops, CVA)"),
    ("Laurence Beer", "Financial Controller", "Leads 2-person finance team covering financial reporting and administration"),
    ("Lucy Savage", "Commercial Manager", "Started in operations team — deep product and client knowledge"),
    ("Paul Simpson", "Commercial Manager", "Started in operations team — deep product and client knowledge"),
    ("Shaun Lipscombe", "Information Security Mgr", "Leads 3-person infosec team. ISO 27001 (Nov 2025), CyberVadis Gold (932)"),
    ("Anja Irwin", "Head of HR", "2 years with GMSL. Manages HR operations and employee engagement"),
]

for i, (name, role, bio) in enumerate(team):
    col = i % 3
    row = i // 3
    left = Cm(1.5 + col * 10.5)
    top = Cm(4.2 + row * 4.6)
    
    # Photo placeholder
    photo = s.shapes.add_shape(MSO_SHAPE.OVAL, left, top, Cm(2), Cm(2))
    photo.fill.solid(); photo.fill.fore_color.rgb = GREY; photo.line.color.rgb = LIGHT_BLUE; photo.line.width = Pt(1)
    p = photo.text_frame.paragraphs[0]; p.text = "📷"
    p.font.size = Pt(12); p.alignment = PP_ALIGN.CENTER
    
    # Name & role
    tx = s.shapes.add_textbox(left + Cm(2.3), top, Cm(7.5), Cm(1))
    tf = tx.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = name; p.font.size = Pt(10); p.font.bold = True; p.font.color.rgb = DARK_BLUE
    p2 = tf.add_paragraph(); p2.text = role; p2.font.size = Pt(8); p2.font.bold = True; p2.font.color.rgb = LIGHT_BLUE
    
    # Bio
    tx2 = s.shapes.add_textbox(left, top + Cm(2.2), Cm(9.8), Cm(2))
    tf = tx2.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = bio; p.font.size = Pt(7); p.font.color.rgb = DARK_BLUE2
add_footer(s)

# ============================================
# SLIDE 36: Zoom on important divisions
# ============================================
s = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(s)
add_header(s, "Team & organisation", "Zoom on important divisions (1/X)", 36)

# Total headcount KPI
bar = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(1.5), Cm(3.3), Cm(31), Cm(1.5))
bar.fill.solid(); bar.fill.fore_color.rgb = DARK_BLUE; bar.line.fill.background()
p = bar.text_frame.paragraphs[0]
p.text = "Total Headcount: 118 FTEs (excl. COO) — All Cambridge-based except CVA team (Birmingham) — Minimal contractor use (£100k FY26F)"
p.font.size = Pt(10); p.font.bold = True; p.font.color.rgb = WHITE; p.alignment = PP_ALIGN.CENTER

# Division boxes
divisions = [
    ("Shipper Ops", "45 FTEs", LIGHT_BLUE, [
        "3 Team Leaders", "6 Shift Leaders", "16 Senior Operators",
        "13 Junior Operators", "Liaison TL, Power TL", "Training Manager",
    ]),
    ("TSO Ops", "15 FTEs", LIGHT_GREEN, [
        "1 Manager", "2 Team Leaders", "6 Senior Operators",
        "6 Junior Operators", "Physically separate for compliance",
    ]),
    ("IT", "40 FTEs", LIGHT_BLUE, [
        "20 Developers", "11 Product Owners", "9 Testers",
        "4 Cloud Engineers", "100% in-house development",
    ]),
    ("Infrastructure", "6 FTEs", LIGHT_GREEN, [
        "Network management", "Hardware support", "DR facility operations",
    ]),
    ("Other", "12 FTEs", GREEN, [
        "Infosec: 3", "Commercial: 3", "Finance: 2",
        "HR: 2", "CVA: 3 (Birmingham)",
    ]),
]

for i, (name, count, color, items) in enumerate(divisions):
    left = Cm(1.5 + i * 6.3)
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Cm(5.5), Cm(5.8), Cm(9))
    box.fill.solid(); box.fill.fore_color.rgb = WHITE
    box.line.color.rgb = color; box.line.width = Pt(1.5)
    # Header
    hbar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, Cm(5.5), Cm(5.8), Cm(1.5))
    hbar.fill.solid(); hbar.fill.fore_color.rgb = color; hbar.line.fill.background()
    tf = hbar.text_frame
    p = tf.paragraphs[0]; p.text = name; p.font.size = Pt(10); p.font.bold = True; p.font.color.rgb = WHITE; p.alignment = PP_ALIGN.CENTER
    p2 = tf.add_paragraph(); p2.text = count; p2.font.size = Pt(9); p2.font.color.rgb = WHITE; p2.alignment = PP_ALIGN.CENTER
    
    tf = box.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.space_before = Pt(22)
    for j, item in enumerate(items):
        if j == 0:
            p.text = f"• {item}"; p.font.size = Pt(8); p.font.color.rgb = DARK_BLUE2; p.space_after = Pt(3)
        else:
            px = tf.add_paragraph(); px.text = f"• {item}"; px.font.size = Pt(8); px.font.color.rgb = DARK_BLUE2; px.space_after = Pt(3)

# Key challenge note
note_box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(1.5), Cm(15), Cm(31), Cm(2.5))
note_box.fill.solid(); note_box.fill.fore_color.rgb = RGBColor(0xF8, 0xF0, 0xE0)
note_box.line.color.rgb = RGBColor(0xE0, 0xC0, 0x80); note_box.line.width = Pt(0.75)
tf = note_box.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.text = "Key Challenge & Strategy"
p.font.size = Pt(10); p.font.bold = True; p.font.color.rgb = DARK_BLUE; p.space_after = Pt(4)
p2 = tf.add_paragraph()
p2.text = "• Frequent turnover in 24/7 operations due to night shifts → requires continuous recruitment and training investment"
p2.font.size = Pt(8); p2.font.color.rgb = DARK_BLUE2; p2.space_after = Pt(2)
p3 = tf.add_paragraph()
p3.text = "• Strategy focuses on employee engagement, learning and development programmes"
p3.font.size = Pt(8); p3.font.color.rgb = DARK_BLUE2
add_footer(s)

prs.save("/tmp/darwin_slides_batch6.pptx")
print("Batch 6 saved: Slides 33, 35, 36")
