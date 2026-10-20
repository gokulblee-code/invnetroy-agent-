import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_pdf():
    pdf_filename = "Merlot_Inventory_AI_Agent_Executive_Report.pdf"
    target_path = os.path.join(os.getcwd(), pdf_filename)
    
    doc = SimpleDocTemplate(
        target_path,
        pagesize=letter,
        rightMargin=32,
        leftMargin=32,
        topMargin=26,
        bottomMargin=26
    )
    
    styles = getSampleStyleSheet()
    
    # Merlot Botanical & Luxury Decor Palette
    PRIMARY = colors.HexColor("#064e3b")     # Deep Forest Emerald
    SECONDARY = colors.HexColor("#047857")   # Rich Green Accent
    ACCENT = colors.HexColor("#0f766e")      # Botanical Teal
    DARK_TEXT = colors.HexColor("#1e293b")   # Slate Charcoal
    MUTED_TEXT = colors.HexColor("#64748b")  # Cool Grey
    LIGHT_BG = colors.HexColor("#f0fdf4")    # Light Emerald Tint
    CARD_BG = colors.HexColor("#f8fafc")     # Light Slate Tint
    BORDER_COLOR = colors.HexColor("#cbd5e1")
    ALERT_BG = colors.HexColor("#fef3c7")    # Warm Amber
    ALERT_BORDER = colors.HexColor("#f59e0b")
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=PRIMARY
    )
    
    subtitle_style = ParagraphStyle(
        'MainSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=MUTED_TEXT
    )
    
    h1_style = ParagraphStyle(
        'SectionHeading1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=PRIMARY,
        spaceBefore=7,
        spaceAfter=3
    )

    h2_style = ParagraphStyle(
        'SectionHeading2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=SECONDARY,
        spaceBefore=5,
        spaceAfter=2
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=DARK_TEXT
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        textColor=DARK_TEXT
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=DARK_TEXT
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white
    )

    table_body = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=DARK_TEXT
    )

    chat_agent = ParagraphStyle(
        'ChatAgent',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=PRIMARY
    )

    chat_vendor = ParagraphStyle(
        'ChatVendor',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#92400e")
    )
    
    story = []
    
    # =============================================================
    # PAGE 1: EXECUTIVE OVERVIEW, WALKTHROUGH & DIALOGUE
    # =============================================================
    header_data = [
        [
            Paragraph("<b>MERLOT HOME DECOR & GARDENING</b>", title_style),
            Paragraph("<b>EXECUTIVE SPECIFICATION REPORT</b><br/>Version 2.2 Enterprise Ready", ParagraphStyle('RAlign', parent=styles['Normal'], alignment=2, fontSize=8, fontName='Helvetica-Bold', textColor=PRIMARY))
        ],
        [
            Paragraph("<b>Merlot AutoProcure AI:</b> Autonomous Sourcing, RAG Price Negotiation & POS Integration", subtitle_style),
            Paragraph("Date: October 2026 | Firm ID: tenant_merlot_01", ParagraphStyle('RAlign2', parent=styles['Normal'], alignment=2, fontSize=7.5, textColor=MUTED_TEXT))
        ]
    ]
    header_table = Table(header_data, colWidths=[380, 168])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceBefore=2, spaceAfter=6))

    # 1. Executive Summary
    story.append(Paragraph("1. Executive Summary & Problem Statement", h1_style))
    summary_text = (
        "In premium home decor and botanical nursery retail, maintaining inventory is uniquely challenging. "
        "Unlike manufactured dry goods, living plants (like <b>Snake Plants, Monsteras, and Fiddle Leaf Figs</b>) "
        "have variable grower seasons, root fragility, and rapid stockout vulnerability during peak demand periods. "
        "Manual vendor check-ins and phone calls tie up store leadership and frequently lead to lost retail sales.<br/>"
        "<b>Merlot AutoProcure AI</b> is an autonomous, closed-loop procurement agent directly integrated with the "
        "Merlot Point-of-Sale (POS) environment. When moving botanical items drop below pre-set safety thresholds, "
        "the agent scans qualified wholesale nurseries, conducts RAG-grounded price negotiations, executes payments within "
        "authorized budgets, and automatically updates store inventory with incoming in-transit stock."
    )
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 5))

    # Executive Highlight KPI Box
    kpi_data = [
        [
            Paragraph("<b>Zero Stockouts</b><br/><font color='#64748b' size=7>Continuous velocity monitoring</font>", ParagraphStyle('KPI', alignment=1, fontSize=8, textColor=PRIMARY)),
            Paragraph("<b>50%+ Gross Margin</b><br/><font color='#64748b' size=7>RAG-enforced price ceiling</font>", ParagraphStyle('KPI', alignment=1, fontSize=8, textColor=PRIMARY)),
            Paragraph("<b>Automated Payouts</b><br/><font color='#64748b' size=7>Up to Rs. 25,000 threshold</font>", ParagraphStyle('KPI', alignment=1, fontSize=8, textColor=PRIMARY)),
            Paragraph("<b>Two-Way POS Sync</b><br/><font color='#64748b' size=7>Instant In-Transit flags</font>", ParagraphStyle('KPI', alignment=1, fontSize=8, textColor=PRIMARY))
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[137, 137, 137, 137])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#a7f3d0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 4))

    # 2. The Non-Technical Walkthrough
    story.append(Paragraph("2. Plain-English Walkthrough (How It Works for Non-IT Staff)", h1_style))
    story.append(Paragraph(
        "Think of this agent as a dedicated <b>Virtual Purchasing Manager ('Alex')</b> working inside Merlot’s back office 24/7:",
        body_style
    ))
    story.append(Spacer(1, 2))

    walkthrough_steps = [
        ("Step 1: Low Stock Detection", "A customer buys a Snake Plant. The POS registers only 24 units remaining (below safety limit of 30). Alex checks sales data and observes 8 pots are sold daily — meaning Merlot faces a total stockout in just 3 days!"),
        ("Step 2: Checking the Filing Cabinet (RAG)", "Before contacting anyone, Alex opens his digital filing cabinet. He checks: (1) Past bills showing Deccan Flora accepted Rs. 270 last month, (2) The owner's rule to never pay over Rs. 250 (securing 50% margin), and (3) Quality standards requiring 10-inch pots with healthy root balls."),
        ("Step 3: Natural WhatsApp Bargaining", "Alex sends a WhatsApp message to Ramesh (Deccan Flora Nursery). Ramesh quotes Rs. 340. Alex counters at Rs. 275 citing order volume (60 units) and repeat orders. Ramesh counters to Rs. 250 for instant payment. Alex verifies Rs. 250 meets Merlot’s profit policy and locks the deal, saving Rs. 5,400!"),
        ("Step 4: Automated Payment Clearance", "The total bill is Rs. 15,000 (60 × Rs. 250). Since this is under the owner’s pre-set safety budget of Rs. 25,000, Alex initiates payment immediately via UPI/Bank transfer and sends the receipt reference to Ramesh."),
        ("Step 5: Store Counter Update", "Alex updates Merlot’s cash counter POS. Staff see: '+60 Snake Plants on the way from Deccan Flora (ETA: 24h)'. When the shipment arrives tomorrow, staff click 'Received', restoring shelves to 84 units.")
    ]

    for title, desc in walkthrough_steps:
        step_content = [
            [Paragraph(f"<b>{title}</b>", body_bold)],
            [Paragraph(desc, callout_style)]
        ]
        step_table = Table(step_content, colWidths=[548])
        step_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(step_table)
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 3))

    # 3. WhatsApp Dialogue Transcript
    story.append(Paragraph("3. Sample Autonomous WhatsApp Negotiation Dialogue", h1_style))

    chat_data = [
        [
            Paragraph("<b>Vendor: Deccan Flora Nursery</b>", chat_vendor),
            Paragraph("<i>'Namaste Merlot team. For 60 units of 10-inch Snake Plants, our wholesale catalog rate is <b>Rs. 340/unit</b> with 1-day direct dispatch.'</i>", body_style)
        ],
        [
            Paragraph("<b>Agent: Merlot AutoProcure AI</b>", chat_agent),
            Paragraph("<i>'Hello Ramesh. We have an immediate requirement for 60 units today. Our historical records show our last PO cleared at Rs. 270. Given our recurring monthly volume and prompt payment, can you confirm <b>Rs. 275/unit</b> for immediate dispatch?'</i>", body_style)
        ],
        [
            Paragraph("<b>Vendor: Deccan Flora Nursery</b>", chat_vendor),
            Paragraph("<i>'Rs. 275 is quite tight due to rising peat costs. However, because Merlot is a long-term partner, we can meet halfway at <b>Rs. 298/unit</b> if dispatch is approved today.'</i>", body_style)
        ],
        [
            Paragraph("<b>Agent: Merlot AutoProcure AI</b>", chat_agent),
            Paragraph("<i>'Our corporate margin policy caps this batch at <b>Rs. 250/unit</b> (retail selling price Rs. 499 requires 50% margin). Can you confirm at Rs. 250/unit with immediate UPI payment?'</i>", body_style)
        ],
        [
            Paragraph("<b>Vendor: Deccan Flora Nursery</b>", chat_vendor),
            Paragraph("<i>'Agreed at <b>Rs. 250/unit</b> for 60 units with immediate payment. We will begin priority packing.'</i>", body_style)
        ],
        [
            Paragraph("<b>Agent: Merlot AutoProcure AI</b>", chat_agent),
            Paragraph("<i>'Confirmed! Deal closed at Rs. 250/unit. Total: Rs. 15,000 (<b>Rs. 5,400 batch savings</b>). Payment Ref #UPI-MERLOT-42036995 authorized. PO-MERLOT-036995 attached.'</i>", body_style)
        ]
    ]

    chat_table = Table(chat_data, colWidths=[140, 408])
    chat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(chat_table)

    # =============================================================
    # PAGE 2: HANDLING UNPREDICTABLE HUMAN SUPPLIERS ("THE RAMESH PROBLEM")
    # =============================================================
    story.append(PageBreak())

    p2_header = Table([
        [
            Paragraph("<b>MERLOT HOME DECOR & GARDENING — HUMAN-AI NEGOTIATION DYNAMICS</b>", ParagraphStyle('P2Head', fontSize=9, fontName='Helvetica-Bold', textColor=PRIMARY)),
            Paragraph("Page 2 of 3", ParagraphStyle('P2HeadR', alignment=2, fontSize=8, textColor=MUTED_TEXT))
        ]
    ], colWidths=[428, 120])
    p2_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))
    story.append(p2_header)
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("4. Handling Unpredictable Human Vendors ('The Ramesh Problem')", h1_style))
    story.append(Paragraph(
        "Ramesh is a human wholesale nursery owner. In reality, he does not speak like a machine. "
        "He sends informal texts, mixes Hindi and English (Hinglish), makes typos, quotes hidden transport costs, "
        "offers substitute sizes when stock is low, or even sends voice notes while working in the greenhouse. "
        "Here is the exact architectural pipeline that prevents Alex from getting confused or overpaying:",
        body_style
    ))
    story.append(Spacer(1, 5))

    # Architecture Breakdown: LLM vs RAG
    division_data = [
        [
            Paragraph("<b>The LLM: The Street-Smart Ear & Translator</b>", ParagraphStyle('Div1', fontName='Helvetica-Bold', fontSize=8.5, textColor=PRIMARY)),
            Paragraph("<b>The RAG: The Strict Financial Accountant & Rulebook</b>", ParagraphStyle('Div2', fontName='Helvetica-Bold', fontSize=8.5, textColor=SECONDARY))
        ],
        [
            Paragraph(
                "• Understands human messiness, slang, Hinglish, typos, and audio voice notes.<br/>"
                "• Reads Ramesh's raw text (e.g. <i>'280 se kam nahi hoga tempo alag lagega'</i>).<br/>"
                "• Extracts structured facts: Offered Base Price = Rs. 280, Extra Delivery = Yes.<br/>"
                "• Crafts polite, culturally fluent replies that sound natural and respectful.",
                callout_style
            ),
            Paragraph(
                "• <b>Does NOT talk directly to Ramesh.</b> Holds the calculator and legal rules.<br/>"
                "• Takes the extracted facts from LLM and tests them against store rules:<br/>"
                "   1. Does Rs. 280 + transport violate our Rs. 250 walkaway ceiling? (YES).<br/>"
                "   2. Does Ramesh usually concede if offered immediate UPI payout? (YES).<br/>"
                "• Strictly forbids LLM from accepting bids that dilute Merlot's 50% margin.",
                callout_style
            )
        ]
    ]
    div_table = Table(division_data, colWidths=[270, 278])
    div_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white])
    ]))
    story.append(div_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Real-World Unpredictable Scenarios & Agent Counter-Measures", h2_style))

    scenarios_table = [
        [
            Paragraph("Supplier Real-World Behavior", table_header),
            Paragraph("How Agent Decodes & Verifies with RAG", table_header),
            Paragraph("Automated Action / Reply", table_header)
        ],
        [
            Paragraph("<b>1. Hinglish / Slang</b><br/><i>'sir 300 me de skta hu kal ni parso bhejunga pakka'</i>", table_body),
            Paragraph("LLM translates text into parameters: Price = Rs. 300, Delivery = 2 days. RAG checks: Rs. 300 exceeds Rs. 250 limit.", table_body),
            Paragraph("Counters in natural tone: <i>'Ramesh ji, 2 din delivery chalega, par rate Rs. 250 final kariye tabhi advance payout nikalega.'</i>", table_body)
        ],
        [
            Paragraph("<b>2. Hidden Transport Costs</b><br/><i>'Plant Rs. 240 ka padega, par tempo ka Rs. 3,000 alag lagega.'</i>", table_body),
            Paragraph("LLM computes real landed cost: (60 × Rs. 240 + Rs. 3,000) / 60 = <b>Rs. 290/unit</b>. RAG detects margin dilution.", table_body),
            Paragraph("Catches the hidden markup: <i>'Tempo charge milakar per pot Rs. 290 pad raha hai. Total bill Rs. 15,000 all-inclusive confirm kariye.'</i>", table_body)
        ],
        [
            Paragraph("<b>3. Plant Size Substitution</b><br/><i>'10-inch khatam hai, 8-inch pot Rs. 220 me de du kya?'</i>", table_body),
            Paragraph("RAG Quality Contract states: <i>'Snake Plants must be 10-inch. Substitutions require manager approval.'</i>", table_body),
            Paragraph("<b>Pauses autonomous loop.</b> Sends 1-click WhatsApp push notification to Sarah Merlot to approve or decline the 8-inch substitute.", table_body)
        ],
        [
            Paragraph("<b>4. WhatsApp Voice Note</b><br/>Ramesh sends a 7-second audio note while walking through nursery.", table_body),
            Paragraph("Gemini Multimodal Audio API transcribes speech into text in real time: <i>'Haan bhai 250 me pack karva raha hu.'</i>", table_body),
            Paragraph("Confirms verbal deal in writing on WhatsApp and sends official PDF Purchase Order with UPI payment reference.", table_body)
        ]
    ]

    sc_tbl = Table(scenarios_table, colWidths=[150, 200, 198])
    sc_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, CARD_BG])
    ]))
    story.append(sc_tbl)
    story.append(Spacer(1, 8))

    # Deadlock Walkaway Box
    story.append(Paragraph("The 'Deadlock Walkaway' Rule: What If Ramesh Refuses to Budge?", h2_style))
    deadlock_card = [
        [
            Paragraph(
                "If Ramesh becomes stubborn (<i>'Ek rupaya kam nahi hoga, lena hai toh lo'</i>):<br/>"
                "<b>1. Strike 1 & 2:</b> Alex tries two polite counter-arguments (citing order volume, then immediate cash payment).<br/>"
                "<b>2. Strike 3 (Walkaway):</b> Alex does not argue or inflate the budget. He politely exits: <i>'Theek hai Ramesh ji, no problem. Hum next batch me dekhte hain.'</i><br/>"
                "<b>3. Automatic Failover:</b> Alex <b>instantly starts a new WhatsApp chat with Vendor #2 (Green Canopy Growers)</b> to secure the order without delay!",
                callout_style
            )
        ]
    ]
    deadlock_table = Table(deadlock_card, colWidths=[548])
    deadlock_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ALERT_BG),
        ('BOX', (0,0), (-1,-1), 1, ALERT_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(deadlock_table)

    # =============================================================
    # PAGE 3: TECHNICAL AUDIT, RULES & SCORECARD
    # =============================================================
    story.append(PageBreak())

    p3_header = Table([
        [
            Paragraph("<b>MERLOT HOME DECOR & GARDENING — TECHNICAL SPECIFICATION & AUDIT</b>", ParagraphStyle('P3Head', fontSize=9, fontName='Helvetica-Bold', textColor=PRIMARY)),
            Paragraph("Page 3 of 3", ParagraphStyle('P3HeadR', alignment=2, fontSize=8, textColor=MUTED_TEXT))
        ]
    ], colWidths=[428, 120])
    p3_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))
    story.append(p3_header)
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceBefore=2, spaceAfter=8))

    # 5. RAG Rules Table
    story.append(Paragraph("5. RAG Financial & Procurement Guardrails", h1_style))
    story.append(Paragraph("The exact conditions and boundaries enforced by the RAG knowledge engine during procurement:", body_style))
    story.append(Spacer(1, 4))

    guardrails_table_data = [
        [
            Paragraph("Rule Name", table_header),
            Paragraph("Condition Formula / Constraint", table_header),
            Paragraph("Operational Agent Behavior", table_header)
        ],
        [
            Paragraph("<b>Hard Price Ceiling</b>", table_body),
            Paragraph("Cost ≤ Selling Price × (1 - 50%) = Rs. 250", table_body),
            Paragraph("Agent strictly aborts or counters down if a vendor quotes above Rs. 250. Never accepts margin dilution.", table_body)
        ],
        [
            Paragraph("<b>Historical Anchoring</b>", table_body),
            Paragraph("Opening Counter ≈ Best Historical Rate", table_body),
            Paragraph("Anchors bargaining by quoting previous low purchase prices (Rs. 270) rather than asking for general discounts.", table_body)
        ],
        [
            Paragraph("<b>Volume Leverage</b>", table_body),
            Paragraph("Batch Size ≥ Vendor MOQ (60 units)", table_body),
            Paragraph("Leverages scale and predictable monthly reorders to negotiate wholesale nursery volume rate.", table_body)
        ],
        [
            Paragraph("<b>Spending Limit</b>", table_body),
            Paragraph("Auto-Approve ≤ Rs. 25,000.00", table_body),
            Paragraph("Transactions under Rs. 25,000 clear automatically. Orders above Rs. 25,000 send 1-click OTP to store owner.", table_body)
        ],
        [
            Paragraph("<b>Plant Quality Standard</b>", table_body),
            Paragraph("10-inch grower pot, pest-free, DOA clause", table_body),
            Paragraph("Demands protective foliage netting, coco-peat base, and free replacement for in-transit plant damage.", table_body)
        ]
    ]

    g_table = Table(guardrails_table_data, colWidths=[110, 190, 248])
    g_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, CARD_BG])
    ]))
    story.append(g_table)
    story.append(Spacer(1, 8))

    # 6. Management Controls
    story.append(Paragraph("6. How the Store Owner / Manager Controls the Agent", h1_style))
    story.append(Paragraph("Merlot management retains 100% authority through three simple, intuitive mechanisms:", body_style))
    story.append(Spacer(1, 4))

    controls_data = [
        [
            Paragraph("<b>Control Channel</b>", table_header),
            Paragraph("How the Owner Uses It", table_header),
            Paragraph("System Impact", table_header)
        ],
        [
            Paragraph("<b>Visual Sliders (GUI)</b>", table_body),
            Paragraph("Move slider on dashboard to set Safety Stock (e.g. 30 units) and Target Margin (50%).", table_body),
            Paragraph("Instantly recalculates reorder points and walkaway ceiling costs across all SKUs.", table_body)
        ],
        [
            Paragraph("<b>Natural Language Directives</b>", table_body),
            Paragraph("Type simple instructions: <i>'During rainy season, pay Rs. 15 extra for fast 24-hour delivery.'</i>", table_body),
            Paragraph("Agent parses intent and adds temporary pricing concessions to the RAG decision model.", table_body)
        ],
        [
            Paragraph("<b>Document Upload (PDFs)</b>", table_body),
            Paragraph("Drag-and-drop supplier contracts, rate-cards, and return policies into the system.", table_body),
            Paragraph("RAG extracts clearing clauses and quotes exact terms back to suppliers during chat.", table_body)
        ]
    ]

    c_table = Table(controls_data, colWidths=[120, 220, 208])
    c_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, CARD_BG])
    ]))
    story.append(c_table)
    story.append(Spacer(1, 8))

    # 7. Validated Dry Run Scorecard
    story.append(Paragraph("7. Validated System Dry Run Scorecard", h1_style))
    
    scorecard_content = [
        [
            Paragraph("<b>Metric / Stage</b>", table_header),
            Paragraph("Target Benchmark", table_header),
            Paragraph("Observed Result", table_header),
            Paragraph("Status", table_header)
        ],
        [
            Paragraph("POS Direct Connection", table_body),
            Paragraph("SQLite localdb connection", table_body),
            Paragraph("Connected to localdb.sqlite", table_body),
            Paragraph("<font color='#059669'><b>PASS</b></font>", table_body)
        ],
        [
            Paragraph("Stockout Identification", table_body),
            Paragraph("Detect stock < 30 units", table_body),
            Paragraph("Snake Plant flagged (24 units, 8/day velocity)", table_body),
            Paragraph("<font color='#059669'><b>PASS</b></font>", table_body)
        ],
        [
            Paragraph("Supplier Discovery Matrix", table_body),
            Paragraph("Rank qualified suppliers", table_body),
            Paragraph("Deccan Flora Nursery ranked #1 (Score 0.95)", table_body),
            Paragraph("<font color='#059669'><b>PASS</b></font>", table_body)
        ],
        [
            Paragraph("Negotiated Savings", table_body),
            Paragraph("Unit cost ≤ Rs. 250.00", table_body),
            Paragraph("Slashed from Rs. 340 to Rs. 250 (Rs. 5,400 total savings)", table_body),
            Paragraph("<font color='#059669'><b>PASS</b></font>", table_body)
        ],
        [
            Paragraph("Auto-Payment Execution", table_body),
            Paragraph("Clear order ≤ Rs. 25,000", table_body),
            Paragraph("Rs. 15,000 paid (UPI Ref #UPI-MERLOT-42036995)", table_body),
            Paragraph("<font color='#059669'><b>PASS</b></font>", table_body)
        ],
        [
            Paragraph("POS In-Transit Sync", table_body),
            Paragraph("Two-way inventory ledger update", table_body),
            Paragraph("+60 units marked In-Transit in POS", table_body),
            Paragraph("<font color='#059669'><b>PASS</b></font>", table_body)
        ]
    ]

    sc_table = Table(scorecard_content, colWidths=[120, 140, 208, 80])
    sc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('ALIGN', (3,1), (3,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, CARD_BG])
    ]))
    story.append(sc_table)
    story.append(Spacer(1, 10))

    # Formal Signoff Box
    signoff_data = [
        [
            Paragraph("<b>PREPARED FOR:</b> Sarah Merlot, Merlot Home Decor & Gardening", ParagraphStyle('Sign', fontSize=8, fontName='Helvetica-Bold', textColor=PRIMARY)),
            Paragraph("<b>SYSTEM STATUS:</b> Production Ready (v2.2)", ParagraphStyle('Sign2', alignment=2, fontSize=8, fontName='Helvetica-Bold', textColor=SECONDARY))
        ]
    ]
    signoff_table = Table(signoff_data, colWidths=[348, 200])
    signoff_table.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,-1), 1, PRIMARY),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(signoff_table)

    doc.build(story)
    print(f"SUCCESS: Generated PDF at: {target_path}")
    return target_path

if __name__ == "__main__":
    generate_pdf()
