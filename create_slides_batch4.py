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
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb = BG_COLOR
def add_header(slide, section, title, page_num):
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Cm(0), Cm(0), prs.slide_width, Cm(1.2))
    shp.fill.solid(); shp.fill.fore_color.rgb = DARK_BLUE; shp.line.fill.background()
    tf = shp.text_frame; p = tf.paragraphs[0]; p.text = section
    p.font.color.rgb = WHITE; p.font.size = Pt(9); p.font.bold = True
    run = p.add_run(); run.text = f"    |    {page_num}"; run.font.color.rgb = LIGHT_BLUE; run.font.size = Pt(9)
    txBox = slide.shapes.add_textbox(Cm(1.5), Cm(1.5), Cm(30), Cm(1.5))
    p = txBox.text_frame.paragraphs[0]; p.text = title
    p.font.size = Pt(18); p.font.bold = True; p.font.color.rgb = DARK_BLUE
def add_footer(slide):
    txBox = slide.shapes.add_textbox(Cm(1), Cm(18), Cm(12), Cm(0.8))
    p = txBox.text_frame.paragraphs[0]; p.text = "Strictly Private and Confidential"
    p.font.size = Pt(7); p.font.color.rgb = RGBColor(0x99,0x99,0x99); p.font.italic = True

# ============================================
# SLIDE 26: Sole CVA for UK beach terminals
# ============================================
s = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(s)
add_header(s, "Product & Services", "Sole Claims Validation Agent for all UK beach terminals since 2004", 26)

# Left - Map placeholder
box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(1.5), Cm(3.5), Cm(18), Cm(14))
box.fill.solid(); box.fill.fore_color.rgb = WHITE
box.line.color.rgb = LIGHT_BLUE; box.line.width = Pt(1)
tf = box.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.text = "UK Beach Terminal Network"
p.font.size = Pt(14); p.font.bold = True; p.font.color.rgb = DARK_BLUE; p.alignment = PP_ALIGN.CENTER
p2 = tf.add_paragraph(); p2.text = "\n\n[Map to be sourced from:\nP.8 GMSL Asset Fiche\n3. Marketing materials > 4. Additional Materials]"
p2.font.size = Pt(10); p2.font.italic = True; p2.font.color.rgb = RGBColor(0x99,0x99,0x99); p2.alignment = PP_ALIGN.CENTER

# Right - CVA details
box2 = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(20.5), Cm(3.5), Cm(12), Cm(14))
box2.fill.solid(); box2.fill.fore_color.rgb = WHITE
box2.line.color.rgb = GREY; box2.line.width = Pt(0.75)
tf = box2.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.text = "Claims Validation Agent (CVA)"
p.font.size = Pt(13); p.font.bold = True; p.font.color.rgb = DARK_BLUE; p.space_after = Pt(10)
items = [
    "Sole CVA for all UK beach terminals since 2004",
    "FY26F CVA revenue: £1.4m (7.9% of total)",
    "Birmingham-based team of 3 dedicated specialists",
    "Monopoly position with no competing providers",
    "Validates gas allocation claims at UK entry/exit points",
    "Mission-critical role in UK gas market infrastructure",
    "Regulatory mandate ensures continued demand",
    "Long-term stable revenue stream with minimal churn risk",
]
for item in items:
    p = tf.add_paragraph(); p.text = f"• {item}"; p.font.size = Pt(9); p.font.color.rgb = DARK_BLUE2; p.space_after = Pt(4)
add_footer(s)

# ============================================
# SLIDE 27: Technology stack
# ============================================
s = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(s)
add_header(s, "Product & Services", "Technology stack", 27)

tech_sections = [
    ("Cloud & Hosting", LIGHT_BLUE, [
        "Chorus hosted on AWS across multiple availability zones (99.9% uptime target)",
        "EuroRunner & CodeRunner hosted on GMSL servers",
        "Full cloud migration strategy underway for scalability and resilience",
    ]),
    ("Security", LIGHT_GREEN, [
        "ISO 27001 certified (November 2025)",
        "CyberVadis Gold status (score: 932/1000)",
        "Aligned with GDPR, NIST, ISO 27001, NIS2 and DORA standards",
        "Regular audits by Fluxys Internal Audit and client questionnaires",
    ]),
    ("Connectivity", LIGHT_BLUE, [
        "MessageRouter: single API to 200+ counterparties",
        "Protocols: AS2, AS4, FTPS, SFTP, web services, ECP",
        "Edig@s messaging standard support",
    ]),
    ("Disaster Recovery", LIGHT_GREEN, [
        "Dedicated DR facility in Cambridge",
        "24/7 IT cover for networks, hardware and communications",
        "Hot-standby site for business continuity",
    ]),
    ("Development", LIGHT_BLUE, [
        "100% developed and maintained in-house",
        "40-person IT team: 20 devs, 11 product owners, 9 testers, 4 cloud engineers",
        "30 years of accumulated domain expertise",
    ]),
]

for i, (title, color, items) in enumerate(tech_sections):
    col = i % 3
    row = i // 3
    left = Cm(1.5 + col * 10.5)
    top = Cm(3.3 + row * 7.8)
    
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Cm(9.8), Cm(7.2))
    box.fill.solid(); box.fill.fore_color.rgb = WHITE
    box.line.color.rgb = color; box.line.width = Pt(1.5)
    # Header bar
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, Cm(9.8), Cm(1))
    bar.fill.solid(); bar.fill.fore_color.rgb = color; bar.line.fill.background()
    tf = bar.text_frame; p = tf.paragraphs[0]; p.text = title
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
# SLIDE 28: Roadmap
# ============================================
s = prs.slides.add_slide(prs.slide_layouts[6]); add_bg(s)
add_header(s, "Product & Services", "Roadmap", 28)

# Timeline phases
phases = [
    ("Short-term\n(0-12 months)", LIGHT_BLUE, [
        "Chorus: Italy PSV confirmed, transit pipeline next",
        "EuroRunner API modernisation",
        "Edig@s v6.1 implementation",
        "PRISMA interface development",
        "Continue ISO 27001 audit cycle",
    ]),
    ("Medium-term\n(12-24 months)", LIGHT_GREEN, [
        "Chorus expansion: Spain and Central Europe",
        "PowerTrak: Central/Eastern Europe rollout",
        "ENOM client migration to Chorus",
        "Cloud migration of legacy products",
        "MessageRouter enrichment",
    ]),
    ("Long-term\n(24+ months)", GREEN, [
        "Full European coverage for Chorus",
        "Complete cloud-native migration",
        "New connectivity options",
        "Hydrogen & CO₂ market support",
        "AI/automation for dispatching operations",
    ]),
]

for i, (phase, color, items) in enumerate(phases):
    left = Cm(1.5 + i * 10.5)
    # Phase box
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Cm(3.5), Cm(9.8), Cm(14))
    box.fill.solid(); box.fill.fore_color.rgb = WHITE
    box.line.color.rgb = color; box.line.width = Pt(1.5)
    # Phase header
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, Cm(3.5), Cm(9.8), Cm(1.5))
    bar.fill.solid(); bar.fill.fore_color.rgb = color; bar.line.fill.background()
    tf = bar.text_frame; p = tf.paragraphs[0]; p.text = phase
    p.font.size = Pt(11); p.font.bold = True; p.font.color.rgb = WHITE; p.alignment = PP_ALIGN.CENTER
    
    tf = box.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.space_before = Pt(24)
    for j, item in enumerate(items):
        if j == 0:
            p.text = f"• {item}"; p.font.size = Pt(9); p.font.color.rgb = DARK_BLUE2; p.space_after = Pt(6)
        else:
            px = tf.add_paragraph(); px.text = f"• {item}"; px.font.size = Pt(9); px.font.color.rgb = DARK_BLUE2; px.space_after = Pt(6)

note = s.shapes.add_textbox(Cm(1.5), Cm(17.3), Cm(25), Cm(0.7))
p = note.text_frame.paragraphs[0]
p.text = "[Detailed technological/product roadmap to be sourced from Infopack]"
p.font.size = Pt(7); p.font.italic = True; p.font.color.rgb = RGBColor(0x99,0x99,0x99)
add_footer(s)

prs.save("/tmp/darwin_slides_batch4.pptx")
print("Batch 4 saved: Slides 26, 27, 28")
