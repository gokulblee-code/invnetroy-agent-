import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_user_manual_pdf():
    pdf_filename = "Autonomous_Inventory_Agent_User_Manual.pdf"
    target_path = os.path.join(os.getcwd(), pdf_filename)
    
    doc = SimpleDocTemplate(
        target_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32
    )
    
    styles = getSampleStyleSheet()
    
    # Modern Professional Documentation Palette
    PRIMARY = colors.HexColor("#0f172a")     # Deep Slate
    SECONDARY = colors.HexColor("#047857")   # Forest Green Accent
    ACCENT = colors.HexColor("#2563eb")      # Corporate Blue
    DARK_TEXT = colors.HexColor("#1e293b")   # Slate Charcoal
    MUTED_TEXT = colors.HexColor("#64748b")  # Cool Grey
    LIGHT_BG = colors.HexColor("#f8fafc")    # Clean Slate Tint
    CARD_BG = colors.HexColor("#ffffff")     # White Card
    BORDER_COLOR = colors.HexColor("#cbd5e1")
    
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
        leading=13.5,
        textColor=MUTED_TEXT
    )
    
    h1_style = ParagraphStyle(
        'SectionHeading1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=PRIMARY,
        spaceBefore=10,
        spaceAfter=5
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=DARK_TEXT
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12.5,
        textColor=DARK_TEXT
    )
    
    faq_q_style = ParagraphStyle(
        'FAQQ',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=PRIMARY
    )

    faq_a_style = ParagraphStyle(
        'FAQA',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=12,
        textColor=DARK_TEXT
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=DARK_TEXT
    )

    step_number_style = ParagraphStyle(
        'StepNum',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=13,
        textColor=colors.white,
        alignment=1
    )

    story = []
    
    # ----------------------------------------------------
    # HEADER BANNER
    # ----------------------------------------------------
    header_data = [
        [
            Paragraph("<b>AUTONOMOUS INVENTORY AGENT</b>", ParagraphStyle('TopHeaderBrand', fontName='Helvetica-Bold', fontSize=10, textColor=PRIMARY)),
            Paragraph("PRODUCT DOCUMENTATION & USER MANUAL", ParagraphStyle('TopHeaderVer', fontName='Helvetica-Bold', fontSize=8.5, textColor=MUTED_TEXT, alignment=2))
        ]
    ]
    header_table = Table(header_data, colWidths=[350, 190])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceBefore=2, spaceAfter=8))
    
    # Title Block
    story.append(Paragraph("Autonomous Inventory & Sourcing Agent — User Manual", title_style))
    story.append(Paragraph("Standard Operating Guide for Automated Stock Replenishment, WhatsApp Vendor Communication, and System Configuration", subtitle_style))
    story.append(Spacer(1, 8))
    
    # Product Overview Box
    overview_text = (
        "<b>System Purpose:</b> The <b>Autonomous Inventory Agent</b> is an automated procurement and stock-monitoring system. "
        "It connects directly to point-of-sale (POS) databases or ERP systems to detect low-stock inventory in real-time, "
        "calculates Economic Order Quantities (EOQ) and Reorder Points (ROP), and automatically coordinates replenishment orders "
        "with wholesale suppliers through WhatsApp without requiring manual staff intervention."
    )
    callout_data = [[
        Paragraph("ℹ️", ParagraphStyle('Icon', fontSize=16, alignment=1)),
        Paragraph(overview_text, callout_style)
    ]]
    callout_table = Table(callout_data, colWidths=[28, 512])
    callout_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(callout_table)
    story.append(Spacer(1, 10))
    
    # ----------------------------------------------------
    # SECTION 1: SYSTEM OPERATION MODES
    # ----------------------------------------------------
    story.append(Paragraph("1. Replenishment Dispatch Modes", h1_style))
    story.append(Paragraph("The agent supports two deployment options depending on the firm's operational requirements:", body_style))
    story.append(Spacer(1, 5))

    mode_comparison_data = [
        [
            Paragraph("<b>Mode 1: Direct 1-Click WhatsApp</b><br/><font color='#047857'><b>(Default — Zero Configuration Required)</b></font>", body_bold),
            Paragraph("<b>Mode 2: 24/7 Automated Cloud WhatsApp</b><br/><font color='#0f766e'><b>(Unattended — Official Meta Cloud API)</b></font>", body_bold)
        ],
        [
            Paragraph(
                "• <b>Mechanism:</b> When inventory stock breaches safety thresholds, clicking <b>'Auto-Restock via WhatsApp'</b> opens the messaging client on the operator's PC or phone.<br/>"
                "• <b>Pre-composed Message:</b> Vendor contact details, purchase order quantities, and target wholesale rates are populated automatically.<br/>"
                "• <b>Verification:</b> Staff reviews and sends the purchase order with one click.<br/>"
                "• <b>Setup:</b> Active immediately upon installation. No external API credentials required.", body_style
            ),
            Paragraph(
                "• <b>Mechanism:</b> The agent communicates directly with Meta's official WhatsApp Business Cloud servers to dispatch and receive messages in the background.<br/>"
                "• <b>Two-Way Negotiation:</b> Vendor counter-proposals are parsed automatically; the agent issues calibrated responses within management-approved pricing guardrails.<br/>"
                "• <b>Zero Touch:</b> Generates Purchase Orders and updates inventory without human presence.<br/>"
                "• <b>Usage Allowance:</b> Meta includes 1,000 service conversations per month without messaging fees.", body_style
            )
        ]
    ]
    mode_table = Table(mode_comparison_data, colWidths=[270, 270])
    mode_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
        ('BACKGROUND', (0,1), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(mode_table)
    story.append(Spacer(1, 10))

    # ----------------------------------------------------
    # SECTION 2: META WHATSAPP INTEGRATION STEPS
    # ----------------------------------------------------
    story.append(Paragraph("2. Official WhatsApp Business API Setup (For Unattended Mode)", h1_style))
    story.append(Paragraph("To enable 24/7 unattended messaging, the following four credentials must be linked in the agent configuration:", body_style))
    story.append(Spacer(1, 5))

    steps_data = [
        [
            Paragraph("<b>Step 1</b>", step_number_style),
            Paragraph("<b>Access Meta Developer Portal</b><br/>Sign in at <u>developers.facebook.com</u>. Select <b>Create App</b> &gt; <b>Business</b>. Add the <b>WhatsApp</b> product to the application.", body_style)
        ],
        [
            Paragraph("<b>Step 2</b>", step_number_style),
            Paragraph("<b>Obtain WhatsApp Phone Number ID</b><br/>Under <b>WhatsApp &gt; API Setup</b>, locate and copy the numeric <b>Phone Number ID</b> (e.g., <code>100609346426845</code>).", body_style)
        ],
        [
            Paragraph("<b>Step 3</b>", step_number_style),
            Paragraph("<b>Generate System User Access Token</b><br/>In Meta Business Suite &gt; <b>System Users</b>, generate a permanent access token with the <code>whatsapp_business_messaging</code> permission. Copy this key string.", body_style)
        ],
        [
            Paragraph("<b>Step 4</b>", step_number_style),
            Paragraph("<b>Apply Settings in Agent Dashboard</b><br/>Open <b>Settings &gt; WhatsApp Auto-Restock Setup</b> in the agent interface. Enter the Phone Number ID and Access Token, then click <b>Save & Apply Settings</b>.", body_style)
        ]
    ]
    steps_table = Table(steps_data, colWidths=[42, 498])
    steps_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), SECONDARY),
        ('BACKGROUND', (1,0), (1,-1), CARD_BG),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(steps_table)
    story.append(Spacer(1, 10))

    # ----------------------------------------------------
    # SECTION 3: FINANCIAL & OPERATIONAL GUARDRAILS
    # ----------------------------------------------------
    story.append(Paragraph("3. Financial Controls & Purchase Authorization", h1_style))
    story.append(Paragraph("The agent operates strictly within firm-defined financial safety parameters:", body_style))
    story.append(Spacer(1, 5))

    safety_data = [
        [
            Paragraph("<b>Auto-Approval Spending Ceiling</b>", body_bold),
            Paragraph("Any restock purchase order totaling <b>less than or equal to the configured ceiling</b> (e.g., ₹25,000) is cleared automatically. Any order exceeding this limit is placed on <b>HOLD</b> and requires authorized manager sign-off.", body_style)
        ],
        [
            Paragraph("<b>Minimum Gross Margin Requirement</b>", body_bold),
            Paragraph("The agent automatically calculates retail-to-wholesale gross margins. Counter-offers are capped so that the firm's required gross margin percentage (e.g., 50%) is strictly preserved.", body_style)
        ],
        [
            Paragraph("<b>Inventory Scan Frequency</b>", body_bold),
            Paragraph("The background watchdog can be scheduled to evaluate POS stock every 10 minutes, every hour, or strictly upon manual user trigger.", body_style)
        ]
    ]
    safety_table = Table(safety_data, colWidths=[180, 360])
    safety_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(safety_table)
    story.append(Spacer(1, 10))

    # Page Break for FAQ Section
    story.append(PageBreak())

    # ----------------------------------------------------
    # SECTION 4: FREQUENTLY ASKED QUESTIONS (FAQ)
    # ----------------------------------------------------
    story.append(Paragraph("4. Frequently Asked Questions (FAQ)", h1_style))
    story.append(Paragraph("Standard operational questions regarding multi-firm deployment and configuration:", subtitle_style))
    story.append(Spacer(1, 6))

    faqs = [
        (
            "Q1: Can this inventory agent be deployed across different companies and industries?",
            "<b>Yes.</b> The system is a universal autonomous procurement platform. Store profiles, firm registration details, GSTIN, corporate bank/UPI identifiers, and product catalogs are managed through the configuration dashboard. The software adapts to supermarkets, pharmacies, apparel retailers, hardware distributors, and specialty stores."
        ),
        (
            "Q2: Are there recurring software licensing costs or cloud hosting fees?",
            "<b>No.</b> The core agent operates locally on store or warehouse infrastructure. Meta's official WhatsApp Business Cloud API provides 1,000 free service conversations monthly per registered business number. Google AI Studio offers a free-tier API allocation sufficient for standard procurement volumes."
        ),
        (
            "Q3: How does the agent operate if external API keys have not been configured?",
            "The system defaults to <b>1-Click WhatsApp Dispatch</b>. Stock evaluation, supplier ranking, and purchase orders are processed locally. Restock orders open directly in the user's WhatsApp client with target prices pre-populated for one-click manual dispatch."
        ),
        (
            "Q4: How does the agent handle supplier counter-proposals on price?",
            "When connected via WhatsApp API, incoming vendor responses are parsed by the agent's evaluation engine. If a vendor quotes above the opening rate, the agent issues calibrated concession offers referencing previous purchase history and prompt settlement terms, while strictly respecting management's price ceiling."
        ),
        (
            "Q5: What is the function of the inbound Webhook endpoint?",
            "The webhook URL (<code>/api/inventory-agent/whatsapp-webhook</code>) serves as the secure receiver for inbound vendor messages sent from Meta's cloud servers to the local inventory agent, enabling two-way automated negotiation."
        ),
        (
            "Q6: How does the agent track inventory levels in real-time?",
            "The agent interfaces with the retail POS database (SQLite or relational database server). As items are sold at checkout terminals, on-hand quantities decrease. When stock levels breach the safety reorder point (ROP), replenishment triggers automatically."
        ),
        (
            "Q7: Where are supplier contacts, wholesale quotes, and terms managed?",
            "Vendor data is maintained in the structured <code>vendors.csv</code> directory file. Suppliers, product associations, baseline quotes, floor prices, and contact information can be viewed, filtered, and updated via the <b>Wholesale Vendors Directory</b> menu."
        ),
        (
            "Q8: What happens in the event of an internet or cloud connectivity interruption?",
            "The agent incorporates an automated offline failover mechanism. If cloud intelligence services are unreachable, the system reverts to an embedded local deterministic calculation engine, ensuring uninterrupted stock analysis and purchase order generation."
        )
    ]

    for q, a in faqs:
        faq_box_data = [
            [Paragraph(f"<b>{q}</b>", faq_q_style)],
            [Paragraph(a, faq_a_style)]
        ]
        faq_box = Table(faq_box_data, colWidths=[540])
        faq_box.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0")),
            ('LINEBELOW', (0,0), (-1,0), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 7),
            ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ]))
        story.append(faq_box)
        story.append(Spacer(1, 4))

    # ----------------------------------------------------
    # DOCUMENT CONTROL FOOTER
    # ----------------------------------------------------
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceBefore=4, spaceAfter=6))
    
    footer_text = (
        "<b>Autonomous Inventory & Sourcing Agent</b> • Technical & Operational Reference Manual • "
        "Standard Edition 3.2 • Applicable to Multi-Tenant Retail & Wholesale Deployments"
    )
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', fontName='Helvetica', fontSize=7, textColor=MUTED_TEXT, alignment=1)))

    doc.build(story)
    print("SUCCESS: User manual PDF successfully generated at: " + target_path)

if __name__ == "__main__":
    generate_user_manual_pdf()
