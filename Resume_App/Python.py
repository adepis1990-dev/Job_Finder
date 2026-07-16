from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
import pdfplumber
from openai import OpenAI
from reportlab.pdfgen import canvas
import os

app = FastAPI()
client = OpenAI(api_key="YOUR_API_KEY")

@app.post("/edit-resume")
async def edit_resume(file: UploadFile = File(...), prompt: str = Form(...)):
    # 1. Read the uploaded PDF text
    extracted_text = ""
    with pdfplumber.open(file.file) as pdf:
        for page in pdf.pages:
            extracted_text += page.extract_text()

    # 2. Send the text + user instructions to the AI
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are an expert resume writer. Rewrite the provided resume text based on the user's goal. Return only the polished resume text."},
            {"role": "user", "content": f"Instruction: {prompt}\n\nResume Text:\n{extracted_text}"}
        ]
    )
    ai_updated_text = response.choices[0].message.content

    # 3. Generate a brand new PDF with the AI text
    output_pdf_path = "updated_resume.pdf"
    c = canvas.Canvas(output_pdf_path)
    
    # Simple text drawing logic (you can make this prettier later)
    y_position = 750
    for line in ai_updated_text.split('\n'):
        c.drawString(50, y_position, line)
        y_position -= 15
        if y_position < 50: # Simple page overflow handling
            c.showPage()
            y_position = 750
            
    c.save()

    # 4. Stream the file straight back to the frontend
    return FileResponse(output_pdf_path, media_type="application/pdf", filename="updated_resume.pdf")