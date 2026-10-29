import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether

def build_pdf(filename="documents/Meta_Pro_Client_Registration_Manual.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    PRIMARY = colors.HexColor("#065f46")   # Deep Emerald
    SECONDARY = colors.HexColor("#0f172a") # Slate 900
    MUTED = colors.HexColor("#64748b")     # Slate 500
    BG_LIGHT = colors.HexColor("#f8fafc")  # Slate 50
    BORDER = colors.HexColor("#e2e8f0")    # Slate 200
    ACCENT = colors.HexColor("#10b981")    # Emerald 500

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=PRIMARY,
        fontName='Helvetica-Bold',
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=MUTED,
        fontName='Helvetica',
        spaceAfter=14
    )

    h2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=17,
        textColor=SECONDARY,
        fontName='Helvetica-Bold',
        spaceBefore=12,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=SECONDARY,
        fontName='Helvetica',
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        textColor=SECONDARY,
        fontName='Courier',
        backColor=BG_LIGHT,
        borderPadding=6,
        spaceAfter=6
    )

    elements = []

    # Title & Metadata
    elements.append(Paragraph("Meta Cloud API & WhatsApp Business Platform Setup Manual", title_style))
    elements.append(Paragraph("Enterprise Autonomous Sourcing Agent Client Registration Guide | Version 2.4", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceAfter=14))

    # Section 1: Overview
    elements.append(Paragraph("1. Executive Overview", h2_style))
    elements.append(Paragraph(
        "This manual details the step-by-step registration workflow required to deploy the Autonomous Procurement "
        "Agent on the <b>Meta for Developers (WhatsApp Cloud API)</b> platform. Once configured, the agent communicates "
        "directly with wholesale nursery and product suppliers via WhatsApp, negotiating prices, enforcing margin disciplines, "
        "and closing purchase orders autonomously.",
        body_style
    ))

    # Section 2: Prerequisites Table
    elements.append(Paragraph("2. Onboarding Prerequisites", h2_style))
    prereqs = [
        [Paragraph("<b>Component</b>", body_style), Paragraph("<b>Specification & Purpose</b>", body_style)],
        [Paragraph("Meta Developer Account", body_style), Paragraph("Active administrator account at <i>developers.facebook.com</i>", body_style)],
        [Paragraph("Meta Business Account", body_style), Paragraph("Verified Business Manager account for production messaging access", body_style)],
        [Paragraph("Dedicated Phone Number", body_style), Paragraph("Clean SIM / number not active on personal or mobile WhatsApp Business app", body_style)],
        [Paragraph("Server Webhook URL", body_style), Paragraph("HTTPS endpoint: <code>https://&lt;domain&gt;/api/inventory-agent/webhook</code>", body_style)]
    ]
    t_prereq = Table(prereqs, colWidths=[150, 380])
    t_prereq.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_prereq)
    elements.append(Spacer(1, 10))

    # Section 3: Step-by-Step Setup
    elements.append(Paragraph("3. Step-by-Step Meta App Registration", h2_style))
    elements.append(Paragraph("<b>Step 1: Create Meta Developer App</b>", body_style))
    elements.append(Paragraph("• Log in to <b>developers.facebook.com/apps</b> and click <b>Create App</b>.", bullet_style))
    elements.append(Paragraph("• Select App Type: <b>Other</b> &rarr; Click Next &rarr; Select <b>Business</b>.", bullet_style))
    elements.append(Paragraph("• Name the App (e.g. <i>Merlot AutoProcure Agent</i>) and link your Meta Business Account.", bullet_style))

    elements.append(Paragraph("<b>Step 2: Add & Configure WhatsApp Product</b>", body_style))
    elements.append(Paragraph("• In the App Dashboard, locate <b>WhatsApp</b> and click <b>Set up</b>.", bullet_style))
    elements.append(Paragraph("• Navigate to <b>WhatsApp &rarr; API Setup</b> from the left navigation tree.", bullet_style))
    elements.append(Paragraph("• Copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID (WABA ID)</b>.", bullet_style))

    elements.append(Paragraph("<b>Step 3: Generate Permanent System User Access Token</b>", body_style))
    elements.append(Paragraph("<i>(Temporary 24-hour test tokens expire daily. Production requires a permanent system token):</i>", body_style))
    elements.append(Paragraph("• Go to <b>business.facebook.com/settings</b> &rarr; <b>Users</b> &rarr; <b>System Users</b>.", bullet_style))
    elements.append(Paragraph("• Add a System User with role <b>Admin</b>.", bullet_style))
    elements.append(Paragraph("• Click <b>Add Assets</b> &rarr; Select your Agent App &rarr; Toggle <b>Full Control</b>.", bullet_style))
    elements.append(Paragraph("• Click <b>Generate New Token</b> &rarr; Select scopes: <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>.", bullet_style))
    elements.append(Paragraph("• Copy and store the resulting token (starts with <code>EAA...</code>).", bullet_style))

    elements.append(Paragraph("<b>Step 4: Configure Webhook Callback</b>", body_style))
    elements.append(Paragraph("• Navigate to <b>WhatsApp &rarr; Configuration</b> &rarr; click <b>Edit</b> under Webhook.", bullet_style))
    elements.append(Paragraph("• <b>Callback URL</b>: <code>https://&lt;domain&gt;/api/inventory-agent/webhook</code>", bullet_style))
    elements.append(Paragraph("• <b>Verify Token</b>: <code>merlot_secure_webhook_token_2026</code> (configured in <code>.env</code>)", bullet_style))
    elements.append(Paragraph("• Click <b>Verify and Save</b> &rarr; under Webhook Fields click <b>Manage</b> &rarr; Subscribe to <b>messages</b>.", bullet_style))

    elements.append(Spacer(1, 8))

    # Section 4: Clean Slate & Profile Registration
    elements.append(Paragraph("4. Initializing a Fresh Client Profile", h2_style))
    elements.append(Paragraph(
        "To clear all prior demonstration artifacts and onboard a new enterprise client from scratch:<br/>"
        "1. Open the cockpit dashboard at <b>http://localhost:5001/</b>.<br/>"
        "2. Click the top-left <b>Store Profile</b> badge &rarr; click <b>Reset Profile to Clean Slate</b>.<br/>"
        "3. Enter the client's store credentials: Legal Firm Name, Address, GSTIN, and Corporate UPI VPA.<br/>"
        "4. Click <b>Save Store & UPI Registration</b>.<br/>"
        "5. Click <b>Reset History</b> in the dashboard header to flush previous chat ledgers and test purchase orders.",
        body_style
    ))

    # Section 5: POS Notice
    elements.append(Paragraph("5. POS Bridge Integration Readiness", h2_style))
    elements.append(Paragraph(
        "The direct POS SQLite bridge is fully architected and ready to attach to your live inventory catalog. "
        "Per strict operational protocol, <b>POS live synchronization is maintained on standby</b> until your explicit "
        "go-ahead instruction.",
        body_style
    ))

    doc.build(elements)
    print("SUCCESS: Generated " + filename)

if __name__ == '__main__':
    build_pdf()
