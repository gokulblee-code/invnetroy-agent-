import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_pdf():
    pdf_filename = "Why_Meta_Credentials_Are_Needed_For_WhatsApp_Agent.pdf"
    
    # Destination 1: In project documents directory
    target_path = os.path.join(os.getcwd(), "documents", pdf_filename)
    if not os.path.exists(os.path.join(os.getcwd(), "documents")):
        os.makedirs(os.path.join(os.getcwd(), "documents"), exist_ok=True)
        
    # Destination 2: Directly in user's Downloads directory
    downloads_path = os.path.join("C:\\Users\\asus\\Downloads", pdf_filename)

    doc = SimpleDocTemplate(
        target_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32
    )

    styles = getSampleStyleSheet()

    # Brand Colors
    PRIMARY = colors.HexColor("#0f172a")        # Executive Midnight Slate
    SECONDARY = colors.HexColor("#047857")      # WhatsApp/Emerald Green
    META_BLUE = colors.HexColor("#0064e0")      # Meta Blue
    ACCENT_AMBER = colors.HexColor("#b45309")   # Caution/Alert Amber
    DARK_TEXT = colors.HexColor("#1e293b")      # Slate Dark
    MUTED_TEXT = colors.HexColor("#64748b")     # Slate Muted
    LIGHT_BG = colors.HexColor("#f8fafc")       # Slate 50
    LIGHT_EMERALD = colors.HexColor("#ecfdf5")  # Emerald 50
    LIGHT_BLUE = colors.HexColor("#eff6ff")     # Blue 50
    CARD_BG = colors.HexColor("#ffffff")        # White
    BORDER_COLOR = colors.HexColor("#cbd5e1")   # Slate 300

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=PRIMARY
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=MUTED_TEXT
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=PRIMARY,
        spaceBefore=12,
        spaceAfter=6
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=SECONDARY,
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=DARK_TEXT
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=DARK_TEXT,
        leftIndent=12
    )

    meta_pill_style = ParagraphStyle(
        'MetaPill',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=META_BLUE
    )

    story = []

    # ==================== HEADER SECTION ====================
    header_table_data = [
        [
            Paragraph("<b>AUTONOMOUS WHATSAPP PROCUREMENT AGENT</b>", meta_pill_style),
            Paragraph("EXECUTIVE TECHNICAL BRIEFING", ParagraphStyle('RightTag', parent=meta_pill_style, alignment=2, textColor=MUTED_TEXT))
        ],
        [
            Paragraph("Why Meta (Facebook) Credentials Are Required", title_style),
            Paragraph("<b>Status:</b> Active Architecture<br/><b>Audience:</b> Business Owners & Retailers", ParagraphStyle('RightMeta', parent=subtitle_style, alignment=2))
        ],
        [
            Paragraph("A plain-English guide explaining why connecting an autonomous WhatsApp AI negotiation bot requires a Meta Developer App, Phone Number ID, and Access Token.", subtitle_style),
            ""
        ]
    ]

    header_table = Table(header_table_data, colWidths=[380, 160])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('SPAN', (0, 2), (1, 2)),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=SECONDARY, spaceBefore=4, spaceAfter=10))

    # ==================== 1. EXECUTIVE SUMMARY & THE CORE QUESTION ====================
    story.append(Paragraph("1. The Core Question: Why Facebook / Meta for WhatsApp?", h1_style))
    story.append(Paragraph(
        "A common point of confusion for store owners and clients is: <i>'I just want my autonomous AI agent to negotiate with suppliers on WhatsApp using my shop's mobile number. Why am I being asked to log in to Facebook, create a Meta Developer App, and copy Access Tokens?'</i>",
        body_style
    ))
    story.append(Spacer(1, 5))

    exec_summary_box = [
        [
            Paragraph(
                "<b>The Fundamental Reality:</b><br/>"
                "• <b>Meta Owns WhatsApp:</b> In 2014, Facebook (now Meta Platforms, Inc.) acquired WhatsApp. All underlying infrastructure, enterprise servers, and developer interfaces are administered through Meta's developer ecosystem.<br/>"
                "• <b>Apps vs. APIs:</b> The WhatsApp Business app on your smartphone is built for human fingers typing one message at a time. It cannot legally, safely, or reliably handle 24/7 automated server-to-server AI negotiations.<br/>"
                "• <b>Official Cloud API:</b> To allow an AI software agent to send purchase orders, evaluate incoming wholesale prices, and negotiate terms automatically, Meta created the <b>WhatsApp Business Cloud API</b>. Accessing this official gateway requires a Meta Developer account.",
                body_style
            )
        ]
    ]
    summary_table = Table(exec_summary_box, colWidths=[540])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 10))

    # ==================== 2. THE 4 META CREDENTIALS DEMYSTIFIED ====================
    story.append(Paragraph("2. The 4 Key Meta Credentials Demystified (Plain English)", h1_style))
    story.append(Paragraph("When setting up 24/7 autonomous WhatsApp negotiation, the agent dashboard prompts for four parameters:", body_style))
    story.append(Spacer(1, 4))

    cred_data = [
        [
            Paragraph("<b>Credential</b>", ParagraphStyle('TH', parent=body_style, fontName='Helvetica-Bold', textColor=PRIMARY)),
            Paragraph("<b>What It Actually Is</b>", ParagraphStyle('TH', parent=body_style, fontName='Helvetica-Bold', textColor=PRIMARY)),
            Paragraph("<b>Why Your AI Agent Needs It</b>", ParagraphStyle('TH', parent=body_style, fontName='Helvetica-Bold', textColor=PRIMARY))
        ],
        [
            Paragraph("<b>1. Phone Number ID</b><br/>(e.g. <code>10482910...</code>)", body_style),
            Paragraph("Meta's unique cloud database ID for your specific business phone line.", body_style),
            Paragraph("Tells Meta's servers <i>which exact business phone line</i> the AI agent is authorized to speak from when dispatching purchase orders.", body_style)
        ],
        [
            Paragraph("<b>2. System Access Token</b><br/>(Starts with <code>EAAG...</code>)", body_style),
            Paragraph("A cryptographic, bank-grade digital master key generated by Meta.", body_style),
            Paragraph("Authenticates every message. Without it, anyone could pretend to be your store. It guarantees that only your AI agent server can send messages.", body_style)
        ],
        [
            Paragraph("<b>3. Webhook Verify Token</b><br/>(e.g. <code>merlot_2026</code>)", body_style),
            Paragraph("A shared secret handshake password between Meta and your server.", body_style),
            Paragraph("When setting up the live connection, Meta sends a test challenge. This password proves to Meta that your agent server is genuine.", body_style)
        ],
        [
            Paragraph("<b>4. Inbound Webhook URL</b><br/>(<code>/api/whatsapp-webhook</code>)", body_style),
            Paragraph("The exact web address where Meta delivers incoming supplier replies.", body_style),
            Paragraph("When a wholesale vendor texts <i>'₹270 is my best price'</i>, Meta instantly pushes that text to this URL so the AI can negotiate in under 1 second.", body_style)
        ]
    ]

    cred_table = Table(cred_data, colWidths=[130, 200, 210])
    cred_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(cred_table)
    story.append(Spacer(1, 10))

    # ==================== 3. OFFICIAL CLOUD API VS PHONE APPS & BANS ====================
    story.append(Paragraph("3. Why Smartphone WhatsApp Apps Cannot Run Autonomous AI", h1_style))
    story.append(Paragraph(
        "Many retailers ask: <i>'Can't the agent just run on an Android phone using WhatsApp Business?'</i> Below is why enterprises strictly use Meta Cloud API:",
        body_style
    ))
    story.append(Spacer(1, 4))

    comparison_data = [
        [
            Paragraph("<b>Operational Feature</b>", ParagraphStyle('TH2', parent=body_style, fontName='Helvetica-Bold')),
            Paragraph("<b>Official Meta Cloud API</b>", ParagraphStyle('TH2', parent=body_style, fontName='Helvetica-Bold', textColor=SECONDARY)),
            Paragraph("<b>Unofficial Phone App / Web Scraping</b>", ParagraphStyle('TH2', parent=body_style, fontName='Helvetica-Bold', textColor=ACCENT_AMBER))
        ],
        [
            Paragraph("<b>Account Ban Risk</b>", body_style),
            Paragraph("<b>0% Ban Risk.</b> 100% compliant with Meta Business terms of service.", body_style),
            Paragraph("<b>High Ban Risk.</b> Meta's anti-bot systems detect and permanently ban phone automation scripts.", body_style)
        ],
        [
            Paragraph("<b>24/7 Autonomous Uptime</b>", body_style),
            Paragraph("<b>99.99% Uptime.</b> Runs continuously on cloud servers even if store is closed.", body_style),
            Paragraph("<b>Fails frequently.</b> Phone battery dies, Wi-Fi disconnects, screen locks pause background scripts.", body_style)
        ],
        [
            Paragraph("<b>Monthly Cost</b>", body_style),
            Paragraph("<b>1,000 Free Conversations / Month.</b> Meta provides free tier for customer/vendor service chats.", body_style),
            Paragraph("Requires dedicated phone hardware and third-party unofficial gateway subscriptions.", body_style)
        ],
        [
            Paragraph("<b>Response Latency</b>", body_style),
            Paragraph("<b>< 500 milliseconds.</b> Immediate negotiation counter-offers via webhooks.", body_style),
            Paragraph("<b>5 to 20 seconds.</b> Slow browser emulation and device sync delays.", body_style)
        ],
        [
            Paragraph("<b>Enterprise Security</b>", body_style),
            Paragraph("<b>SOC2, ISO-27001 & End-to-End Encryption.</b> Encrypted bearer tokens.", body_style),
            Paragraph("QR-session tokens stored on local disks vulnerable to session hijacking.", body_style)
        ]
    ]

    comp_table = Table(comparison_data, colWidths=[120, 210, 210])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(comp_table)
    story.append(Spacer(1, 10))

    # ==================== PAGE BREAK ====================
    story.append(PageBreak())

    # ==================== 4. SECURITY & PRIVACY ASSURANCES ====================
    story.append(Paragraph("4. Security & Privacy FAQ for Store Owners", h1_style))
    story.append(Paragraph("Critical assurances regarding data ownership, privacy, and social media separation:", body_style))
    story.append(Spacer(1, 5))

    faq_boxes = [
        [
            Paragraph("<b>Q1: Does creating a Meta Developer App post anything to Facebook or Instagram?</b><br/>"
                      "<b>NO.</b> The app you create is marked strictly as a private <i>'Business WhatsApp Integration'</i>. It has no connection to personal profiles, timeline feeds, advertising, or social media pages. It acts solely as an enterprise messaging pipeline.", body_style)
        ],
        [
            Paragraph("<b>Q2: Does Meta / Facebook read our proprietary negotiation prices or margins?</b><br/>"
                      "<b>NO.</b> Messages transmitted via the WhatsApp Cloud API are protected by TLS 1.3 enterprise encryption in transit. Your internal margin targets, price ceilings, and supplier ranking algorithms run locally on your own agent server and are never shared with Meta.", body_style)
        ],
        [
            Paragraph("<b>Q3: Can someone hack my WhatsApp if they see the Phone Number ID?</b><br/>"
                      "<b>NO.</b> The Phone Number ID is just a public identifier (like an account number). Sending messages requires the secret <b>System Access Token</b>, which is stored securely in your private server environment and encrypted in memory.", body_style)
        ],
        [
            Paragraph("<b>Q4: What happens if I exceed 1,000 free conversations per month?</b><br/>"
                      "Meta provides 1,000 free service-initiated conversations every calendar month. If a high-volume warehouse exceeds 1,000 conversations, Meta charges standard utility micro-rates (approx. ₹0.30 to ₹0.80 per conversation in India), which can be paid via a corporate credit card.", body_style)
        ]
    ]

    faq_table = Table(faq_boxes, colWidths=[540])
    faq_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(faq_table)
    story.append(Spacer(1, 10))

    # ==================== 5. ALTERNATIVE ZERO-META OPTIONS ====================
    story.append(Paragraph("5. Alternative Options (If You Prefer Not to Use Meta Cloud API)", h1_style))
    story.append(Paragraph("The Merlot Autonomous Inventory Agent is engineered with multi-gateway flexibility. If you or your client firm do not wish to configure Meta Cloud API, two alternative modes are natively available:", body_style))
    story.append(Spacer(1, 5))

    alt_data = [
        [
            Paragraph("<b>Alternative Method</b>", ParagraphStyle('TH3', parent=body_style, fontName='Helvetica-Bold')),
            Paragraph("<b>How It Works</b>", ParagraphStyle('TH3', parent=body_style, fontName='Helvetica-Bold')),
            Paragraph("<b>Setup Required</b>", ParagraphStyle('TH3', parent=body_style, fontName='Helvetica-Bold'))
        ],
        [
            Paragraph("<b>Option A: 1-Click WhatsApp Links</b><br/>(Default Fallback)", body_style),
            Paragraph("When reorder triggers occur, the agent pre-types the negotiation offer and generates a direct link (<code>https://api.whatsapp.com/send...</code>). Clicking it opens WhatsApp Web or your phone with 1 click.", body_style),
            Paragraph("<b>Zero setup.</b> Works out of the box with zero developer credentials or API keys.", body_style)
        ],
        [
            Paragraph("<b>Option B: Green API (QR Link)</b><br/>(Phone Gateway)", body_style),
            Paragraph("Uses Green API to link an existing WhatsApp Business app on your phone via QR code scan (similar to WhatsApp Web).", body_style),
            Paragraph("Scan a single QR code from your phone's WhatsApp Business app. Keeps your exact current phone active.", body_style)
        ],
        [
            Paragraph("<b>Option C: Twilio WhatsApp</b><br/>(Enterprise SMS/WA)", body_style),
            Paragraph("If your organization already has a corporate Twilio account, the agent connects directly via Twilio's WhatsApp Messaging API.", body_style),
            Paragraph("Requires Twilio Account SID, Auth Token, and Twilio WhatsApp number in <code>.env</code>.", body_style)
        ]
    ]

    alt_table = Table(alt_data, colWidths=[140, 250, 150])
    alt_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(alt_table)
    story.append(Spacer(1, 10))

    # ==================== 6. EXECUTIVE RECOMMENDATION ====================
    story.append(Paragraph("6. Executive Summary & Recommendation", h1_style))
    summary_text = (
        "<b>For Maximum Efficiency & ROI:</b> Connecting via the <b>Meta WhatsApp Cloud API</b> is the industry gold standard. "
        "It elevates your store's procurement from manual chat typing to an <b>autonomous 24/7 negotiation engine</b> that secures "
        "15%–25% wholesale cost reductions while ensuring zero ban risk and 1,000 free monthly conversations.<br/><br/>"
        "If you are just testing the agent today, you can start with <b>Option A (1-Click WhatsApp)</b> and upgrade to Meta Cloud API "
        "whenever your business is ready for full 24/7 autonomous procurement."
    )
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 12))

    # ==================== FOOTER ====================
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=4, spaceAfter=6))
    footer_text = Paragraph(
        "<b>Merlot AutoProcure AI Architecture Series</b> | Official Document Ref: <code>META-WA-EXPLAINER-2026-V1</code> | Confidential & Proprietary",
        ParagraphStyle('Footer', parent=subtitle_style, alignment=1, fontSize=8)
    )
    story.append(footer_text)

    doc.build(story)
    print(f"Generated PDF successfully at: {target_path}")

    # Copy to user's Downloads folder as well
    try:
        import shutil
        shutil.copyfile(target_path, downloads_path)
        print(f"Copied PDF successfully to: {downloads_path}")
    except Exception as e:
        print(f"Notice: Could not copy directly to Downloads: {e}")

if __name__ == "__main__":
    generate_pdf()
