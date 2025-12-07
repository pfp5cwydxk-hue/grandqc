"""
Generate professional PDF report from GrandQC pipeline outputs.
Includes GrandQC quality score and artifact percentage analysis.
"""

import os
import json
import numpy as np
from PIL import Image
import argparse
from pathlib import Path
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


def get_slide_statistics(output_dir, slide_name):
    """Extract statistics from pipeline outputs."""
    stats = {
        'slide_name': slide_name,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'tissue_detected': False,
        'artifact_counts': {},
        'quality_score': 0.0,
        'artifact_percentage': 0.0,
    }
    
    # Check tissue mask
    tissue_mask_path = os.path.join(output_dir, 'tis_det_mask', f'{slide_name}_MASK.png')
    if os.path.exists(tissue_mask_path):
        try:
            tissue_mask = np.array(Image.open(tissue_mask_path))
            tissue_pixels = np.count_nonzero(tissue_mask == 0)  # 0 = tissue in mask
            total_pixels = tissue_mask.size
            tissue_percentage = (tissue_pixels / total_pixels * 100) if total_pixels > 0 else 0
            stats['tissue_detected'] = True
            stats['tissue_percentage'] = round(tissue_percentage, 2)
            stats['tissue_pixels'] = int(tissue_pixels)
            stats['total_pixels'] = int(total_pixels)
        except Exception as e:
            print(f"Error reading tissue mask: {e}")
    
    # Check QC mask for artifact counts
    qc_mask_path = os.path.join(output_dir, 'mask_qc', f'{slide_name}_mask.png')
    if os.path.exists(qc_mask_path):
        try:
            qc_mask = np.array(Image.open(qc_mask_path))
            unique, counts = np.unique(qc_mask, return_counts=True)
            
            # Class labels: 0=tissue, 1=background, 2=fold, 3=dark_spot, 4=pen, 5=bubble, 6=out_of_focus, 7=background
            class_names = {
                0: 'Clean Tissue',
                1: 'Background',
                2: 'Tissue Folds',
                3: 'Dark Spots/Foreign Objects',
                4: 'Pen Markings',
                5: 'Air Bubbles/Slide Edges',
                6: 'Out-of-Focus Areas',
                7: 'Background'
            }
            
            for cls_id, count in zip(unique, counts):
                if cls_id in class_names:
                    stats['artifact_counts'][class_names[cls_id]] = int(count)
            
            # Calculate GrandQC quality score (0-100): percentage of clean tissue
            clean_tissue = stats['artifact_counts'].get('Clean Tissue', 0)
            total_tissue = sum([v for k, v in stats['artifact_counts'].items() if k != 'Background'])
            if total_tissue > 0:
                quality_score = (clean_tissue / total_tissue * 100)
                stats['quality_score'] = round(quality_score, 2)
                # Artifact percentage is inverse of quality
                stats['artifact_percentage'] = round(100 - quality_score, 2)
            else:
                stats['artifact_percentage'] = 0.0
        except Exception as e:
            print(f"Error reading QC mask: {e}")
    
    return stats


def generate_pdf_report(output_dir, slide_names=None):
    """Generate professional PDF report."""
    
    if not os.path.exists(output_dir):
        print(f"Output directory not found: {output_dir}")
        return None
    
    # Get slide name from directory or list
    if not slide_names:
        slides_in = os.path.join(output_dir, 'slides_in')
        if os.path.exists(slides_in):
            slide_files = [f for f in os.listdir(slides_in) if f.lower().endswith(('.svs', '.ndpi', '.tif'))]
            slide_names = [os.path.splitext(f)[0] for f in slide_files]
        else:
            print("No slides found in output directory")
            return None
    
    # Create PDF
    pdf_path = os.path.join(output_dir, 'report.pdf')
    doc = SimpleDocTemplate(pdf_path, pagesize=letter,
                            rightMargin=0.5*inch, leftMargin=0.5*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)
    
    story = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1f4788'),
        spaceAfter=12,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    story.append(Paragraph('PathInsight QC Report', title_style))
    story.append(Spacer(1, 0.2*inch))
    
    # Subtitle with timestamp
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.grey,
        alignment=TA_CENTER
    )
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    story.append(Paragraph(f'Generated: {timestamp}', subtitle_style))
    story.append(Spacer(1, 0.3*inch))
    
    # Process each slide
    for slide_name in slide_names:
        stats = get_slide_statistics(output_dir, slide_name)
        
        # Slide heading
        slide_heading = ParagraphStyle(
            'SlideHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#2e5c8a'),
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )
        story.append(Paragraph(f'Slide: {slide_name}', slide_heading))
        
        # Key metrics
        metrics_style = ParagraphStyle(
            'Metrics',
            parent=styles['Normal'],
            fontSize=12,
            fontName='Helvetica-Bold',
            spaceAfter=6
        )
        
        # GrandQC Score (quality)
        grandqc_color = '#27ae60' if stats['quality_score'] >= 80 else '#f39c12' if stats['quality_score'] >= 60 else '#e74c3c'
        story.append(Paragraph(
            f"<b>GrandQC Quality Score:</b> <font color='{grandqc_color}'>{stats['quality_score']}%</font>",
            metrics_style
        ))
        
        # Artifact Percentage
        artifact_color = '#e74c3c' if stats['artifact_percentage'] > 20 else '#f39c12' if stats['artifact_percentage'] > 10 else '#27ae60'
        story.append(Paragraph(
            f"<b>Artifact Percentage:</b> <font color='{artifact_color}'>{stats['artifact_percentage']}%</font>",
            metrics_style
        ))
        
        story.append(Paragraph(
            f"<b>Tissue Detected:</b> {stats.get('tissue_percentage', 0)}%",
            metrics_style
        ))
        story.append(Spacer(1, 0.15*inch))
        
        # Artifact breakdown table
        if stats['artifact_counts']:
            story.append(Paragraph('<b>Artifact Breakdown:</b>', ParagraphStyle(
                'TableTitle', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold'
            )))
            
            table_data = [['Artifact Type', 'Pixel Count', '% of Total']]
            total_pixels = sum(stats['artifact_counts'].values())
            
            for artifact_type, count in sorted(stats['artifact_counts'].items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_pixels * 100) if total_pixels > 0 else 0
                table_data.append([
                    artifact_type,
                    str(count),
                    f'{percentage:.1f}%'
                ])
            
            artifact_table = Table(table_data, colWidths=[2.5*inch, 1.5*inch, 1.0*inch])
            artifact_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2e5c8a')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f0f0')]),
            ]))
            story.append(artifact_table)
        
        story.append(Spacer(1, 0.3*inch))
        
        # Add overlay image if available
        overlay_path = os.path.join(output_dir, 'visualization_overlays', f'{slide_name}_visualization.jpg')
        if os.path.exists(overlay_path):
            story.append(Paragraph('<b>Quality Overlay Visualization:</b>', ParagraphStyle(
                'ImageTitle', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold'
            )))
            try:
                img = RLImage(overlay_path, width=6.5*inch, height=3.5*inch)
                story.append(img)
            except:
                story.append(Paragraph('(Overlay image not available)', styles['Normal']))
        
        story.append(PageBreak())
    
    # Build PDF
    doc.build(story)
    print(f'✅ PDF report saved to: {pdf_path}')
    return pdf_path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate PDF report from GrandQC pipeline outputs')
    parser.add_argument('--output_dir', required=True, help='Pipeline output directory')
    parser.add_argument('--slide_names', nargs='*', help='Slide names (optional, auto-detect if not provided)')
    
    args = parser.parse_args()
    generate_pdf_report(args.output_dir, args.slide_names)
