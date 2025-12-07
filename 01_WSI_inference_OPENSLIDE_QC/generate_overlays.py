"""
Generate visual overlay images showing QC results on WSI thumbnails.
"""

import os
import numpy as np
from PIL import Image
import argparse


def create_overlay_visualization(output_dir, slide_name):
    """
    Create a composite overlay image showing:
    1. Original WSI thumbnail
    2. QC mask with artifact classes colored
    3. Tissue detection overlay
    """
    
    # Paths
    tissue_thumb_path = os.path.join(output_dir, 'tis_det_thumbnail', f'{slide_name}.jpg')
    if not os.path.exists(tissue_thumb_path):
        tissue_thumb_path = os.path.join(output_dir, 'tis_det_thumbnail', f'{slide_name}.svs.jpg')
    if not os.path.exists(tissue_thumb_path):
        tissue_thumb_path = os.path.join(output_dir, 'tis_det_thumbnail', f'{slide_name}.ndpi.jpg')
    
    qc_mask_path = os.path.join(output_dir, 'mask_qc', f'{slide_name}_mask.png')
    tissue_mask_col_path = os.path.join(output_dir, 'tis_det_mask_col', f'{slide_name}.svs_MASK_COL.png')
    
    # Check if required files exist
    if not os.path.exists(tissue_thumb_path):
        print(f"Tissue thumbnail not found: {tissue_thumb_path}")
        return None
    
    # Load original thumbnail
    original = Image.open(tissue_thumb_path).convert('RGB')
    width, height = original.size
    
    # If we have QC mask, create overlay
    if os.path.exists(qc_mask_path):
        try:
            qc_mask = Image.open(qc_mask_path).convert('RGB')
            qc_mask = qc_mask.resize((width, height), Image.Resampling.NEAREST)
            
            # Blend original with QC mask (30% mask, 70% original)
            qc_overlay = Image.blend(original, qc_mask, 0.3)
        except Exception as e:
            print(f"Error creating QC overlay: {e}")
            qc_overlay = original.copy()
    else:
        qc_overlay = original.copy()
    
    # If we have tissue mask, create tissue overlay
    if os.path.exists(tissue_mask_col_path):
        try:
            tissue_mask = Image.open(tissue_mask_col_path).convert('RGB')
            tissue_mask = tissue_mask.resize((width, height), Image.Resampling.NEAREST)
            
            # Blend original with tissue mask (40% mask, 60% original)
            tissue_overlay = Image.blend(original, tissue_mask, 0.4)
        except Exception as e:
            print(f"Error creating tissue overlay: {e}")
            tissue_overlay = original.copy()
    else:
        tissue_overlay = original.copy()
    
    # Create a composite image with all three side-by-side
    composite_width = width * 3 + 20  # 20 pixels padding between images
    composite_height = height + 60     # Extra space for labels
    
    composite = Image.new('RGB', (composite_width, composite_height), color='white')
    
    # Paste original
    composite.paste(original, (10, 50))
    
    # Paste tissue overlay
    composite.paste(tissue_overlay, (width + 10, 50))
    
    # Paste QC overlay
    composite.paste(qc_overlay, (width * 2 + 10, 50))
    
    # Add labels
    try:
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(composite)
        
        # Try to use a decent font, fall back to default
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        except:
            font = ImageFont.load_default()
        
        # Draw labels
        labels = ['Original', 'Tissue Detection', 'QC Overlay']
        for idx, label in enumerate(labels):
            x = 10 + idx * (width + 10) + width // 2 - 40
            y = 10
            draw.text((x, y), label, fill='black', font=font)
    except Exception as e:
        print(f"Warning: Could not add labels: {e}")
    
    return composite


def main():
    parser = argparse.ArgumentParser(description='Generate visual overlay images')
    parser.add_argument('--output_dir', required=True, help='Path to pipeline output directory')
    
    args = parser.parse_args()
    
    # Get slide names
    slides_dir = os.path.join(args.output_dir, 'slides_in')
    if not os.path.exists(slides_dir):
        print(f"Slides directory not found: {slides_dir}")
        return
    
    slide_names = [f.replace('.svs', '').replace('.ndpi', '').replace('.tiff', '') 
                  for f in os.listdir(slides_dir) 
                  if os.path.isfile(os.path.join(slides_dir, f))]
    
    if not slide_names:
        print("No slides found to process")
        return
    
    # Create output directory
    overlay_dir = os.path.join(args.output_dir, 'visualization_overlays')
    os.makedirs(overlay_dir, exist_ok=True)
    
    # Generate overlays
    for slide_name in slide_names:
        print(f"Generating overlay for: {slide_name}")
        
        overlay = create_overlay_visualization(args.output_dir, slide_name)
        
        if overlay:
            output_path = os.path.join(overlay_dir, f'{slide_name}_visualization.jpg')
            overlay.save(output_path, quality=95)
            print(f"  ✅ Saved to: {output_path}")
        else:
            print(f"  ❌ Failed to generate overlay")
    
    print(f"\n✅ All overlays generated in: {overlay_dir}")


if __name__ == '__main__':
    main()
