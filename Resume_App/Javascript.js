import React, { useState } from 'react';

function App() {
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please upload a resume first!");

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prompt', prompt);

    try {
      const response = await fetch('http://localhost:8000/edit-resume', {
        method: 'POST',
        body: formData,
      });

      // Turn the response stream into a downloadable file blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "My_Updated_Resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error("Error updating resume:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '500px', margin: '0 auto' }}>
      <h2>AI Resume Editor</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label>Upload Current Resume (PDF):</label>
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label>What do you want to change?</label>
          <textarea 
            rows="4" 
            style={{ width: '100%' }}
            placeholder="e.g., Tailor this to a Junior Data Analyst role and highlight my Python skills" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "AI is rewriting & generating PDF..." : "Update Resume"}
        </button>
      </form>
    </div>
  );
}

export default App;