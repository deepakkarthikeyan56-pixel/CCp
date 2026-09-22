import os
import json
import csv
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.units import inch
from database import get_db


def generate_pdf_report(user_id, predictions=None, models=None):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []

    title = Paragraph("Customer Churn Prediction Report", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 12))

    date_para = Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal'])
    elements.append(date_para)
    elements.append(Spacer(1, 24))

    conn = get_db()

    if predictions is None:
        predictions = conn.execute(
            'SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
            (user_id,)
    ).fetchall()

    if models is None:
        models = conn.execute(
            'SELECT * FROM model_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            (user_id,)
        ).fetchall()

    conn.close()

    elements.append(Paragraph("Prediction Summary", styles['Heading2']))
    elements.append(Spacer(1, 8))

    total = len(predictions)
    churn_count = sum(1 for p in predictions if p['prediction_result'] == 'Churn')
    stay_count = total - churn_count

    summary_data = [
        ['Metric', 'Value'],
        ['Total Predictions', str(total)],
        ['Churn Predicted', str(churn_count)],
        ['Stay Predicted', str(stay_count)],
        ['Churn Rate', f'{(churn_count/total*100):.1f}%' if total > 0 else '0%'],
    ]

    table = Table(summary_data, colWidths=[3*inch, 2*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 24))

    elements.append(Paragraph("Model Performance", styles['Heading2']))
    elements.append(Spacer(1, 8))

    if models:
        model_data = [['Algorithm', 'Accuracy', 'F1 Score', 'Date']]
        for m in models:
            model_data.append([
                m['algorithm'],
                f"{m['accuracy']*100:.1f}%",
                f"{m['f1_score']*100:.1f}%",
                m['created_at'][:10] if m['created_at'] else 'N/A'
            ])

        table2 = Table(model_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        table2.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ]))
        elements.append(table2)
    else:
        elements.append(Paragraph("No models trained yet.", styles['Normal']))

    elements.append(Spacer(1, 24))

    elements.append(Paragraph("Recent Predictions", styles['Heading2']))
    elements.append(Spacer(1, 8))

    if predictions:
        pred_data = [['ID', 'Result', 'Probability', 'Algorithm', 'Date']]
        for p in predictions[:20]:
            pred_data.append([
                str(p['id']),
                p['prediction_result'],
                f"{p['probability']*100:.1f}%",
                p['algorithm_used'] or 'N/A',
                p['created_at'][:10] if p['created_at'] else 'N/A'
            ])

        table3 = Table(pred_data, colWidths=[0.6*inch, 1.2*inch, 1.2*inch, 1.5*inch, 1.2*inch])
        table3.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#06B6D4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ]))
        elements.append(table3)
    else:
        elements.append(Paragraph("No predictions made yet.", styles['Normal']))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_csv_report(user_id):
    conn = get_db()
    predictions = conn.execute(
        'SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC',
        (user_id,)
    ).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Customer Name', 'Result', 'Probability', 'Algorithm', 'Date'])

    for p in predictions:
        writer.writerow([
            p['id'],
            p['customer_name'] or 'N/A',
            p['prediction_result'],
            f"{p['probability']*100:.1f}%",
            p['algorithm_used'] or 'N/A',
            p['created_at'][:10] if p['created_at'] else 'N/A'
        ])

    output.seek(0)
    return io.BytesIO(output.getvalue().encode('utf-8'))


def generate_excel_report(user_id):
    import pandas as pd
    conn = get_db()
    predictions = conn.execute(
        'SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC',
        (user_id,)
    ).fetchall()
    models = conn.execute(
        'SELECT * FROM model_history WHERE user_id = ? ORDER BY created_at DESC',
        (user_id,)
    ).fetchall()
    conn.close()

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        pred_df = pd.DataFrame([dict(p) for p in predictions])
        if not pred_df.empty:
            pred_df.to_excel(writer, sheet_name='Predictions', index=False)

        model_df = pd.DataFrame([dict(m) for m in models])
        if not model_df.empty:
            model_df.to_excel(writer, sheet_name='Models', index=False)

    buffer.seek(0)
    return buffer
