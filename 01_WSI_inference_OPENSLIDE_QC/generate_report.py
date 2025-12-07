"""
Generate HTML report from GrandQC pipeline outputs.
Creates a professional report with statistics, charts, and visual overlays.
"""

import os
import json
import numpy as np
from PIL import Image
import argparse
from pathlib import Path
from datetime import datetime


def get_slide_statistics(output_dir, slide_name):
    """Extract statistics from pipeline outputs."""
    stats = {
        'slide_name': slide_name,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'tissue_detected': False,
        'artifact_counts': {},
        'quality_score': 0.0,
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
            
            # Calculate quality score (0-100)
            clean_tissue = stats['artifact_counts'].get('Clean Tissue', 0)
            total_tissue = sum([v for k, v in stats['artifact_counts'].items() if k != 'Background'])
            if total_tissue > 0:
                quality_score = (clean_tissue / total_tissue * 100)
                stats['quality_score'] = round(quality_score, 2)
        except Exception as e:
            print(f"Error reading QC mask: {e}")
    
    return stats


def generate_html_report(output_dir, slide_names=None):
    """Generate HTML report for processed slides."""
    
    if not os.path.exists(output_dir):
        print(f"Output directory not found: {output_dir}")
        return None
    
    # Get list of slide names from input directory
    if slide_names is None:
        slides_dir = os.path.join(output_dir, 'slides_in')
        if os.path.exists(slides_dir):
            slide_names = [f.replace('.svs', '').replace('.ndpi', '').replace('.tiff', '') 
                          for f in os.listdir(slides_dir) 
                          if os.path.isfile(os.path.join(slides_dir, f))]
        else:
            slide_names = []
    
    # Collect statistics for all slides
    all_stats = []
    for slide_name in slide_names:
        stats = get_slide_statistics(output_dir, slide_name)
        all_stats.append(stats)
    
    # Generate HTML
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GrandQC Quality Control Report</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }}
        
        header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }}
        
        header h1 {{
            font-size: 2.5em;
            margin-bottom: 10px;
        }}
        
        header p {{
            font-size: 1.1em;
            opacity: 0.95;
        }}
        
        .content {{
            padding: 40px;
        }}
        
        .report-info {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }}
        
        .info-card {{
            padding: 15px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid #667eea;
        }}
        
        .info-card label {{
            font-weight: 600;
            color: #555;
            display: block;
            margin-bottom: 5px;
        }}
        
        .info-card .value {{
            font-size: 1.3em;
            color: #667eea;
            font-weight: 700;
        }}
        
        .slides-section {{
            margin-top: 40px;
        }}
        
        .slide-card {{
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 25px;
            margin-bottom: 25px;
            transition: all 0.3s ease;
        }}
        
        .slide-card:hover {{
            box-shadow: 0 8px 24px rgba(0,0,0,0.1);
            transform: translateY(-2px);
        }}
        
        .slide-card h3 {{
            color: #333;
            margin-bottom: 15px;
            font-size: 1.4em;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }}
        
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 25px;
        }}
        
        .metric {{
            padding: 15px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid #667eea;
        }}
        
        .metric label {{
            font-weight: 600;
            color: #666;
            display: block;
            margin-bottom: 5px;
            font-size: 0.95em;
        }}
        
        .metric-value {{
            font-size: 1.5em;
            font-weight: 700;
            color: #667eea;
        }}
        
        .quality-bar {{
            width: 100%;
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin-top: 10px;
        }}
        
        .quality-fill {{
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 0.9em;
            transition: width 0.3s ease;
        }}
        
        .artifact-table {{
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 6px;
            overflow: hidden;
            margin-top: 15px;
        }}
        
        .artifact-table th {{
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }}
        
        .artifact-table td {{
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
        }}
        
        .artifact-table tr:last-child td {{
            border-bottom: none;
        }}
        
        .artifact-table tr:hover {{
            background: #f8f9fa;
        }}
        
        .images-section {{
            margin-top: 25px;
            padding-top: 25px;
            border-top: 2px solid #e0e0e0;
        }}
        
        .images-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-top: 15px;
        }}
        
        .image-container {{
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 10px;
            text-align: center;
        }}
        
        .image-container img {{
            max-width: 100%;
            height: auto;
            border-radius: 4px;
        }}
        
        .image-container p {{
            margin-top: 10px;
            color: #666;
            font-weight: 500;
            font-size: 0.95em;
        }}
        
        footer {{
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #999;
            font-size: 0.9em;
            border-top: 1px solid #e0e0e0;
        }}
        
        .quality-excellent {{ color: #28a745; }}
        .quality-good {{ color: #17a2b8; }}
        .quality-fair {{ color: #ffc107; }}
        .quality-poor {{ color: #dc3545; }}
        
        @media (max-width: 768px) {{
            .report-info {{
                grid-template-columns: 1fr;
            }}
            
            .metrics-grid {{
                grid-template-columns: 1fr;
            }}
            
            .images-grid {{
                grid-template-columns: 1fr;
            }}
            
            header h1 {{
                font-size: 1.8em;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔬 GrandQC Quality Control Report</h1>
            <p>Automated Histopathology Slide Quality Assessment</p>
        </header>
        
        <div class="content">
            <div class="report-info">
                <div class="info-card">
                    <label>Report Generated</label>
                    <div class="value">{datetime.now().strftime('%Y-%m-%d')}</div>
                </div>
                <div class="info-card">
                    <label>Total Slides Processed</label>
                    <div class="value">{len(all_stats)}</div>
                </div>
                <div class="info-card">
                    <label>Average Quality Score</label>
                    <div class="value">{round(np.mean([s.get('quality_score', 0) for s in all_stats]), 1)}%</div>
                </div>
            </div>
            
            <div class="slides-section">
"""
    
    # Add slide details
    for idx, stats in enumerate(all_stats, 1):
        quality_score = stats.get('quality_score', 0)
        
        # Quality rating
        if quality_score >= 80:
            quality_class = 'quality-excellent'
            quality_text = 'Excellent'
        elif quality_score >= 60:
            quality_class = 'quality-good'
            quality_text = 'Good'
        elif quality_score >= 40:
            quality_class = 'quality-fair'
            quality_text = 'Fair'
        else:
            quality_class = 'quality-poor'
            quality_text = 'Poor'
        
        html_content += f"""
                <div class="slide-card">
                    <h3>Slide {idx}: {stats['slide_name']}</h3>
                    
                    <div class="metrics-grid">
                        <div class="metric">
                            <label>Tissue Coverage</label>
                            <div class="metric-value">{stats.get('tissue_percentage', 0):.1f}%</div>
                        </div>
                        <div class="metric">
                            <label>Quality Score</label>
                            <div class="metric-value {quality_class}">{quality_score:.1f}%</div>
                        </div>
                        <div class="metric">
                            <label>Quality Rating</label>
                            <div class="metric-value {quality_class}">{quality_text}</div>
                        </div>
                        <div class="metric">
                            <label>Processed</label>
                            <div class="metric-value">{stats['timestamp']}</div>
                        </div>
                    </div>
                    
                    <div class="quality-bar">
                        <div class="quality-fill" style="width: {quality_score}%">
                            {quality_score:.0f}%
                        </div>
                    </div>
"""
        
        # Artifact counts
        if stats.get('artifact_counts'):
            html_content += """
                    <div style="margin-top: 25px;">
                        <h4 style="color: #333; margin-bottom: 15px;">Artifact Detection Results</h4>
                        <table class="artifact-table">
                            <thead>
                                <tr>
                                    <th>Classification</th>
                                    <th>Pixel Count</th>
                                    <th>Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
"""
            
            total_classified = sum(stats['artifact_counts'].values())
            for artifact_type, count in sorted(stats['artifact_counts'].items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_classified * 100) if total_classified > 0 else 0
                html_content += f"""
                                <tr>
                                    <td><strong>{artifact_type}</strong></td>
                                    <td>{count:,}</td>
                                    <td>{percentage:.1f}%</td>
                                </tr>
"""
            
            html_content += """
                            </tbody>
                        </table>
                    </div>
"""
        
        # Images section
        html_content += """
                    <div class="images-section">
                        <h4 style="color: #333; margin-bottom: 15px;">Visual Analysis</h4>
                        <div class="images-grid">
"""
        
        # Tissue detection thumbnail
        tissue_thumb_path = os.path.join(output_dir, 'tis_det_thumbnail', f'{stats["slide_name"]}.jpg')
        if os.path.exists(tissue_thumb_path):
            html_content += f"""
                            <div class="image-container">
                                <img src="data:image/jpeg;base64,{_image_to_base64(tissue_thumb_path)}" alt="Tissue Detection">
                                <p>Tissue Detection</p>
                            </div>
"""
        
        # Overlay image
        overlay_path = os.path.join(output_dir, 'overlays_qc', f'{stats["slide_name"]}_overlay_QC.jpg')
        if not os.path.exists(overlay_path):
            # Fallback to tissue detection overlay
            overlay_path = os.path.join(output_dir, 'tis_det_overlay', f'{stats["slide_name"]}.svs_OVERLAY.jpg')
        
        if os.path.exists(overlay_path):
            html_content += f"""
                            <div class="image-container">
                                <img src="data:image/jpeg;base64,{_image_to_base64(overlay_path)}" alt="QC Overlay">
                                <p>Quality Control Overlay</p>
                            </div>
"""
        
        html_content += """
                        </div>
                    </div>
                </div>
"""
    
    html_content += """
            </div>
        </div>
        
        <footer>
            <p>Generated by GrandQC v1.0 | Tissue Detection & Multi-Class Artifact Segmentation</p>
            <p>For more information: <a href="https://github.com/cpath-ukk/grandqc" style="color: #667eea;">github.com/cpath-ukk/grandqc</a></p>
        </footer>
    </div>
</body>
</html>
"""
    
    return html_content


def _image_to_base64(image_path):
    """Convert image to base64 for embedding in HTML."""
    import base64
    try:
        with open(image_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    except Exception as e:
        print(f"Error encoding image {image_path}: {e}")
        return ""


def main():
    parser = argparse.ArgumentParser(description='Generate HTML report from GrandQC outputs')
    parser.add_argument('--output_dir', required=True, help='Path to pipeline output directory')
    parser.add_argument('--report_name', default='report.html', help='Name of output HTML file')
    
    args = parser.parse_args()
    
    print("Generating HTML report...")
    html = generate_html_report(args.output_dir)
    
    if html:
        report_path = os.path.join(args.output_dir, args.report_name)
        with open(report_path, 'w') as f:
            f.write(html)
        print(f"✅ Report saved to: {report_path}")
    else:
        print("❌ Failed to generate report")


if __name__ == '__main__':
    main()
