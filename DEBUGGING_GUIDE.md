# Debugging Guide: Object Tags

## How to Check Console Logs

### Step 1: Open Browser Developer Tools

**Chrome/Edge:**
- Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)
- Or right-click on the page → "Inspect" or "Inspect Element"

**Firefox:**
- Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)
- Or right-click → "Inspect Element"

**Safari:**
- Press `Cmd+Option+I` (Mac)
- Or enable Developer menu: Safari → Preferences → Advanced → "Show Develop menu"

### Step 2: Navigate to Console Tab

1. Once Developer Tools opens, click the **"Console"** tab
2. This is where all `console.log()` output appears

### Step 3: View the Debug Output

When you load a page with room images, you should see logs like:

```
=== DETECTED OBJECTS DEBUG ===
DETECTED OBJECTS: [{ id: "obj_table", label: "table", bbox: [0.1, 0.2, 0.5, 0.6] }, ...]
detectedObjects.length: 3
detectedObjects type: object
currentImage.detected_items: "[{\"id\":\"obj_table\",\"label\":\"table\",...}]"
imageBounds: { x: 100, y: 50, width: 800, height: 800 }
First object sample: { id: "obj_table", label: "table", category: "furniture", bbox: [0.1, 0.2, 0.5, 0.6] }
First object bbox: [0.1, 0.2, 0.5, 0.6]
Object "table" bbox calc: { bbox: [...], imageBounds: {...}, calculated: {...}, isValid: true }
```

### Step 4: Filter Console Output

- Use the filter box at the top of the console
- Type "DETECTED" to see only object detection logs
- Type "bbox" to see only bounding box calculations

### Step 5: Check for Errors

Look for:
- ❌ `undefined` or `[]` → Objects not reaching frontend
- ❌ `width: 0` or `height: 0` → BBox math issue  
- ❌ Red boxes off-image → Coordinate system issue

## Visual Debugging

### Red Borders on Tags

If object tags are rendering, you should see:
- **Red borders** around detected objects (2px solid red)
- **Red semi-transparent background** (rgba(255,0,0,0.2))
- Tags positioned over the actual objects in the image

If you see:
- Red boxes **outside the image** → Coordinate system mismatch
- Red boxes **too small** (near zero size) → BBox calculation error
- **No red boxes at all** → Objects not detected or not reaching frontend

## Quick Test

1. Open your app in the browser
2. Navigate to a project page with room images
3. Open Developer Console (F12)
4. Look for the `=== DETECTED OBJECTS DEBUG ===` log
5. Check if `detectedObjects.length > 0`
6. Look at the image - do you see red borders around objects?

## Common Issues

### Issue: No console logs at all
- **Solution**: Make sure you're on a page that has room images loaded
- Check that `RoomImageViewer` component is rendering

### Issue: `detectedObjects: []`
- **Solution**: Check `currentImage.detected_items`` in console
- If it's `'null'` → Detection failed (check API logs)
- If it's `'[]'` → Detection succeeded but found no objects

### Issue: Red boxes but wrong position
- **Solution**: Check `imageBounds` in console
- Verify `imageBounds.width` and `imageBounds.height` match actual image size
- Check if `imageBounds.x` and `imageBounds.y` account for letterboxing

