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

prs = Presentation()
prs.slide_width = Cm(33.867)
prs.slide_height = Cm(19.05)

def add_bg(slide):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = BG_COLOR

def add_header(slide, section, title, page_num):
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Cm(0), Cm(0), prs.slide_width, Cm(1.2))
    shp.fill.solid()
    shp.fill.fore_color.rgb = DARK_BLUE
    shp.line.fill.background()
    tf = shp.text_frame
    p = tf.paragraphs[0]
    p.text = section
    p.font.color.rgb = WHITE
    p.font.size = Pt(9)
    p.font.bold = True
    run = p.add_run()
    run.text = f"    |    {page_num}"
    run.font.color.rgb = LIGHT_BLUE
    run.font.size = Pt(9)
    txBox = slide.shapes.add_textbox(Cm(1.5), Cm(1.5), Cm(30), Cm(1.5))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = DARK_BLUE

def add_footer(slide):
    txBox = slide.shapes.add_textbox(Cm(1), Cm(18), Cm(12), Cm(0.8))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = "Strictly Private and Confidential"
    p.font.size = Pt(7)
    p.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
    p.font.italic = True

# ============================================
# SLIDE 18: Competitive Landscape
# ============================================
slide18 = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide18)
add_header(slide18, "Market", "Competitive landscape of energy scheduling & dispatching providers in EU", 18)

# Subtitle
sub = slide18.shapes.add_textbox(Cm(1.5), Cm(3.0), Cm(30), Cm(1))
tf = sub.text_frame
p = tf.paragraphs[0]
p.text = "GMSL is a niche, ultra-performant player in scheduling energy flows — competitors are more diversified but less best-of-breed on this specific segment"
p.font.size = Pt(9)
p.font.italic = True
p.font.color.rgb = DARK_BLUE2

# Table
rows, cols = 8, 8
tbl = slide18.shapes.add_table(rows, cols, Cm(1.5), Cm(4.2), Cm(31), Cm(13)).table

headers = ["", "GMSL", "Energy One", "Brady", "NavitaSoft", "DispoGas", "Volue"]
metrics = [
    "Revenue",
    "Revenue Growth",
    "EBITDA / EBITDA Margin",
    "# of Acquisitions",
    "Revenue Quality\n(% Software Revenue)",
    "# of Clients / Churn Rate",
    "# TSO Connections in EU\n24/7 Coverage Gas/Power",
]

# Style header row
for j, h in enumerate(headers):
    cell = tbl.cell(0, j)
    cell.text = h
    for para in cell.text_frame.paragraphs:
        para.font.size = Pt(8)
        para.font.bold = True
        para.font.color.rgb = WHITE
        para.alignment = PP_ALIGN.CENTER
    cell.fill.solid()
    cell.fill.fore_color.rgb = DARK_BLUE

# Metric rows
for i, metric in enumerate(metrics):
    cell = tbl.cell(i+1, 0)
    cell.text = metric
    for para in cell.text_frame.paragraphs:
        para.font.size = Pt(8)
        para.font.bold = True
        para.font.color.rgb = DARK_BLUE
    cell.fill.solid()
    cell.fill.fore_color.rgb = RGBColor(0xF0, 0xF0, 0xF0)
    
    for j in range(1, cols):
        cell = tbl.cell(i+1, j)
        cell.text = "[Data]"
        for para in cell.text_frame.paragraphs:
            para.font.size = Pt(8)
            para.font.color.rgb = DARK_BLUE2
            para.alignment = PP_ALIGN.CENTER
        if j == 1:  # GMSL column highlighted
            cell.fill.solid()
            cell.fill.fore_color.rgb = RGBColor(0xE8, 0xF6, 0xF9)
        else:
            cell.fill.solid()
            cell.fill.fore_color.rgb = WHITE

# Set column widths
tbl.columns[0].width = Cm(6)
for j in range(1, cols):
    tbl.columns[j].width = Cm(4.2)

add_footer(slide18)

# ============================================
# SLIDE 20: GMSL at the heart of energy exchange
# ============================================
slide20 = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide20)
add_header(slide20, "Product & Services", "GMSL is positioned at the heart of the energy exchange place", 20)

# Left - Map placeholder
map_box = slide20.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(1.5), Cm(3.5), Cm(18), Cm(14))
map_box.fill.solid()
map_box.fill.fore_color.rgb = WHITE
map_box.line.color.rgb = LIGHT_BLUE
map_box.line.width = Pt(1)
tf = map_box.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "GMSL Connectivity Map in Europe"
p.font.size = Pt(14)
p.font.bold = True
p.font.color.rgb = DARK_BLUE
p.alignment = PP_ALIGN.CENTER
p2 = tf.add_paragraph()
p2.text = "\n\n[Map to be sourced from:\nP.8 GMSL Asset Fiche\n3. Marketing materials > 4. Additional Materials]"
p2.font.size = Pt(10)
p2.font.italic = True
p2.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
p2.alignment = PP_ALIGN.CENTER

# Right - Why clients use GMSL
right_box = slide20.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(20.5), Cm(3.5), Cm(12), Cm(14))
right_box.fill.solid()
right_box.fill.fore_color.rgb = WHITE
right_box.line.color.rgb = GREY
right_box.line.width = Pt(0.75)
tf = right_box.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "Why Clients Use GMSL"
p.font.size = Pt(13)
p.font.bold = True
p.font.color.rgb = DARK_BLUE
p.space_after = Pt(10)

reasons = [
    "Single connection point to 200+ TSO/SSO counterparties via MessageRouter",
    "24/7/365 outsourced dispatching from Cambridge control room",
    "Mission-critical scheduling & nomination software (gas + power)",
    "Certified TSO connectivity across European networks",
    "30+ years of specialised energy market knowledge",
    "Regulatory compliance (Edig@s, AS2, AS4 protocols)",
    "High reliability: dedicated DR facility, hot-standby site",
    "Cost-effective vs. building in-house capabilities",
]
for item in reasons:
    p = tf.add_paragraph()
    p.text = f"• {item}"
    p.font.size = Pt(9)
    p.font.color.rgb = DARK_BLUE2
    p.space_after = Pt(4)

# Source note
note = slide20.shapes.add_textbox(Cm(20.5), Cm(16), Cm(12), Cm(1))
tf = note.text_frame
p = tf.paragraphs[0]
p.text = "[Text source: Slide 7 Skeleton Grégoire]"
p.font.size = Pt(8)
p.font.italic = True
p.font.color.rgb = RGBColor(0x99, 0x99, 0x99)

add_footer(slide20)

# ============================================
# SLIDE 22: Track record of product expansion
# ============================================
slide22 = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide22)
add_header(slide22, "Product & Services", "GMSL has a strong track record of product expansion", 22)

# Timeline style - product launch boxes
products = [
    ("CodeRunner", "Gas nomination\n& scheduling", "UK gas networks\nFluxys, NBP", LIGHT_BLUE),
    ("EuroRunner", "Multi-network gas\nportfolio management", "European gas hubs\nBenelux, Germany", LIGHT_GREEN),
    ("ENOM / ENOM+", "Energy nomination\nworkflow", "UK & European\ngas markets", LIGHT_BLUE),
    ("PowerTrak", "Power scheduling\nwith ETRM integration", "European power\nmarkets", LIGHT_GREEN),
    ("Chorus", "Modern cloud-native\nSaaS platform", "Italy, Spain\nCentral Europe", LIGHT_BLUE),
]

# Timeline line
line = slide22.shapes.add_shape(MSO_SHAPE.RECTANGLE, Cm(3), Cm(9.5), Cm(28), Cm(0.15))
line.fill.solid()
line.fill.fore_color.rgb = DARK_BLUE
line.line.fill.background()

for i, (name, desc, market, color) in enumerate(products):
    left = Cm(2 + i * 6.2)
    
    # Product box
    box = slide22.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Cm(4), Cm(5.5), Cm(5))
    box.fill.solid()
    box.fill.fore_color.rgb = WHITE
    box.line.color.rgb = color
    box.line.width = Pt(1.5)
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = name
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = DARK_BLUE
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(8)
    p2 = tf.add_paragraph()
    p2.text = desc
    p2.font.size = Pt(9)
    p2.font.color.rgb = DARK_BLUE2
    p2.alignment = PP_ALIGN.CENTER
    p2.space_after = Pt(6)
    p3 = tf.add_paragraph()
    p3.text = market
    p3.font.size = Pt(8)
    p3.font.color.rgb = color
    p3.alignment = PP_ALIGN.CENTER
    
    # Timeline dot
    dot = slide22.shapes.add_shape(MSO_SHAPE.OVAL, left + Cm(2.3), Cm(9.1), Cm(0.9), Cm(0.9))
    dot.fill.solid()
    dot.fill.fore_color.rgb = color
    dot.line.fill.background()

    # Launch date placeholder below timeline
    txBox = slide22.shapes.add_textbox(left, Cm(10.2), Cm(5.5), Cm(1))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = "[Launch date TBC]"
    p.font.size = Pt(8)
    p.font.italic = True
    p.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
    p.alignment = PP_ALIGN.CENTER

# Roadmap note
note_box = slide22.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(1.5), Cm(12), Cm(31), Cm(5.5))
note_box.fill.solid()
note_box.fill.fore_color.rgb = RGBColor(0xF8, 0xF0, 0xE0)
note_box.line.color.rgb = RGBColor(0xE0, 0xC0, 0x80)
note_box.line.width = Pt(0.75)
tf = note_box.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "Product Roadmap (inputs needed from management)"
p.font.size = Pt(12)
p.font.bold = True
p.font.color.rgb = DARK_BLUE
p.space_after = Pt(6)

roadmap_items = [
    "EuroRunner API modernisation and Edig@s v6.1 upgrade",
    "PRISMA interface integration",
    "Chorus expansion to new European markets (Italy transit, Spain, Central Europe)",
    "PowerTrak Central/Eastern Europe rollout",
    "Full cloud migration strategy (AWS) for legacy products",
    "ENOM client migration to Chorus platform",
]
for item in roadmap_items:
    p = tf.add_paragraph()
    p.text = f"→ {item}"
    p.font.size = Pt(9)
    p.font.color.rgb = DARK_BLUE2
    p.space_after = Pt(3)

add_footer(slide22)

prs.save("/tmp/darwin_slides_batch2.pptx")
print("Batch 2 saved: Slides 18, 20, 22")
