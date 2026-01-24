# Troubleshooting Guide

## LLM Floor Plan Analysis Issues

### Service Unavailable

**Symptom:** Yellow banner appears: "AI Analysis Service Unavailable"

**Possible Causes:**
1. LLM service is not running
2. LLM service is running on wrong port
3. Network connectivity issues

**Solutions:**

1. **Check if the LLM service is running:**
   ```bash
   # Check if port 8000 is in use
   lsof -i :8000
   # OR on Windows
   netstat -ano | findstr :8000
   ```

2. **Start the LLM service:**
   ```bash
   cd LLM
   uv run uvicorn src.api:app --host 0.0.0.0 --port 8000
   ```

3. **Verify the service is responding:**
   ```bash
   curl http://localhost:8000/health
   ```

4. **Check environment variables:**
   - Ensure `LLM_SERVICE_URL=http://localhost:8000` is set in root `.env`
   - Verify API keys are configured in `LLM/.env`

---

### Analysis Fails with Timeout Error

**Symptom:** "LLM analysis timed out after 60 seconds"

**Possible Causes:**
1. Large or complex floor plan taking too long to process
2. RasterScan API is slow or unresponsive
3. Claude API is slow or rate-limited

**Solutions:**

1. **Try a simpler floor plan:**
   - Use a smaller image (< 5MB)
   - Try a cleaner floor plan with less detail

2. **Check API status:**
   - RasterScan: https://status.rasterscan.com (if available)
   - Anthropic: https://status.anthropic.com

3. **Verify API keys are valid:**
   ```bash
   # Test from LLM directory
   cd LLM
   python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('ANTHROPIC_API_KEY:', os.getenv('ANTHROPIC_API_KEY')[:20] + '...')"
   ```

4. **Check network connectivity:**
   ```bash
   curl https://backend.rasterscan.com
   curl https://api.anthropic.com
   ```

---

### Analysis Fails with RasterScan Error

**Symptom:** Error message mentions "RasterScan failed" or "vectorization failed"

**Possible Causes:**
1. Invalid RasterScan API key
2. Unsupported file format
3. Floor plan image quality too low

**Solutions:**

1. **Verify RasterScan API key:**
   - Check that `RASTERSCAN_API_KEY` is set correctly in `LLM/.env`
   - Ensure the key has not expired

2. **Check file format:**
   - Supported formats: PNG, JPG, JPEG, PDF
   - Try converting the file to PNG
   - Ensure the file is not corrupted

3. **Improve image quality:**
   - Use higher resolution images (at least 1024px on shortest side)
   - Ensure floor plan lines are clear and visible
   - Remove watermarks or overlays if possible

---

### Analysis Fails with Claude Error

**Symptom:** Error message mentions "Claude API failed" or "analysis failed"

**Possible Causes:**
1. Invalid Anthropic API key
2. Rate limiting
3. Content moderation triggered

**Solutions:**

1. **Verify Anthropic API key:**
   - Check that `ANTHROPIC_API_KEY` is set correctly in both `.env` and `LLM/.env`
   - Test the key using Anthropic's API directly

2. **Check rate limits:**
   - Visit https://console.anthropic.com to check your usage
   - Wait a few minutes and try again
   - Consider upgrading your API tier if needed

3. **Content issues:**
   - Ensure the floor plan doesn't contain sensitive or inappropriate content
   - Try a different floor plan to rule out content moderation

---

### Database Migration Issues

**Symptom:** Error about missing `annotated_floor_plan_url` column

**Solution:**

The migration should run automatically on app start. If it doesn't:

1. **Manual migration:**
   ```bash
   sqlite3 sqlite.db "ALTER TABLE projects ADD COLUMN annotated_floor_plan_url TEXT;"
   ```

2. **Verify the column exists:**
   ```bash
   sqlite3 sqlite.db "PRAGMA table_info(projects);"
   ```

3. **If issues persist, restart the Next.js dev server:**
   ```bash
   # Kill the process
   pkill -f "next dev"
   # Start again
   npm run dev
   ```

---

### File Upload Issues

**Symptom:** "File too large" or "Invalid file type" error

**Solutions:**

1. **File size:**
   - Maximum size is 20MB
   - Compress large images using tools like TinyPNG or ImageOptim
   - For PDFs, try reducing the resolution in your PDF viewer

2. **File type:**
   - Only PDF, PNG, JPG, JPEG are supported
   - Convert other formats using an image editor or online converter

3. **Browser issues:**
   - Clear browser cache
   - Try a different browser
   - Disable browser extensions that might interfere with uploads

---

### SSE Connection Drops

**Symptom:** Upload progress stops or hangs

**Possible Causes:**
1. Network connectivity issues
2. Browser tab backgrounded (browser throttles SSE)
3. Server timeout

**Solutions:**

1. **Keep the browser tab active:**
   - Don't switch tabs during upload
   - Don't minimize the browser

2. **Check network stability:**
   - Ensure stable internet connection
   - Try again on a different network if possible

3. **Increase timeout (for development):**
   ```typescript
   // In app/api/floor-plan/upload/route.ts
   export const maxDuration = 180; // Increase to 3 minutes
   ```

---

### Images Not Displaying

**Symptom:** Floor plan or annotated image shows broken image icon

**Possible Causes:**
1. File permissions issue
2. Incorrect URL path
3. File was not saved successfully

**Solutions:**

1. **Check file permissions:**
   ```bash
   ls -la public/uploads/floor-plans/
   # Ensure files are readable
   chmod 644 public/uploads/floor-plans/*
   ```

2. **Verify files exist:**
   ```bash
   ls public/uploads/floor-plans/
   ```

3. **Check database:**
   ```bash
   sqlite3 sqlite.db "SELECT floor_plan_url, annotated_floor_plan_url FROM projects WHERE id=1;"
   ```

4. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

---

## General Debugging

### Enable Debug Logging

Add to your `.env.local`:
```env
NODE_ENV=development
DEBUG=*
```

### Check Server Logs

- **Next.js logs:** Check the terminal where `npm run dev` is running
- **LLM service logs:** Check the terminal where the Python service is running

### Test Individual Components

1. **Test LLM service directly:**
   ```bash
   curl -X POST http://localhost:8000/analyze \
     -F "file=@path/to/floorplan.png"
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:3000/api/floor-plan/health
   ```

3. **Run integration tests:**
   ```bash
   npx tsx scripts/test-llm-integration.ts
   ```

---

## Getting Help

If you continue to experience issues:

1. **Check the logs** in both terminals (Next.js and LLM service)
2. **Review error messages** carefully - they often contain specific details
3. **Test with a simple floor plan** to isolate the issue
4. **Verify all environment variables** are set correctly
5. **Ensure all dependencies are installed** (`npm install` and `uv pip install -r requirements.txt`)

### Common Quick Fixes

```bash
# Restart everything
pkill -f "next dev"
pkill -f "uvicorn"

# Clear caches
rm -rf .next
rm -rf node_modules/.cache

# Reinstall dependencies
npm install
cd LLM && uv pip install -r requirements.txt

# Restart services
npm run dev &
cd LLM && uv run uvicorn src.api:app --port 8000 &
```
