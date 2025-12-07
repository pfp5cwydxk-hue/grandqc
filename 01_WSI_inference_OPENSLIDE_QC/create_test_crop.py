"""
Create a small test WSI crop from a full slide for fast pipeline testing.
"""

import os
import argparse
from PIL import Image
import openslide


def create_test_wsi_crop(input_slide_path, output_path, region_size=1024, level=0):
    """Extract a small region from a WSI for testing."""
    try:
        slide = openslide.OpenSlide(input_slide_path)
        
        # Get dimensions at level 0
        width, height = slide.level_dimensions[0]
        
        # Extract from center at level 0
        x = max(0, (width - region_size) // 2)
        y = max(0, (height - region_size) // 2)
        
        print(f"Extracting {region_size}x{region_size} region from center of slide")
        
        # Read at full resolution
        region = slide.read_region((x, y), 0, (region_size, region_size))
        
        # Convert to RGB
        if region.mode == 'RGBA':
            rgb = Image.new('RGB', region.size, (255, 255, 255))
            rgb.paste(region, mask=region.split()[3])
            region = rgb
        elif region.mode != 'RGB':
            region = region.convert('RGB')
        
        # Save as JPEG
        region.save(output_path, 'JPEG', quality=95)
        print(f'✅ Test crop saved to: {output_path}')
        
        slide.close()
        return output_path
        
    except Exception as e:
        print(f'Error: {e}')
        return None


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Create a small test WSI crop')
    parser.add_argument('--input_slide', required=True, help='Input WSI file path')
    parser.add_argument('--output_path', required=True, help='Output crop file path')
    parser.add_argument('--region_size', type=int, default=2048, help='Region size in pixels')
    
    args = parser.parse_args()
    create_test_wsi_crop(args.input_slide, args.output_path, args.region_size)
