import React, { useState } from "react";
import axios from "axios";
import "./App.css";

const App = () => {
  const [fileKey, setFileKey] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [selectedLang, setSelectedLang] = useState("HTML & CSS");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [designElements, setDesignElements] = useState(null);
  const [designSnapshot, setDesignSnapshot] = useState(null);

  // API Keys from environment variables
  const FIGMA_API_KEY = process.env.REACT_APP_FIGMA_API_KEY;
  const GEMINI_API_KEY = process.env.REACT_APP_GRAMINI_API_KEY;

  // Load Figma Design and extract elements
  const handleEmbed = async () => {
    setError("");
    setIsLoading(true);
    
    if (!fileKey) {
      setError("Please enter a valid Figma file key.");
      setIsLoading(false);
      return;
    }

    try {
      // Set embed URL for preview
      setEmbedUrl(`https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${fileKey}`);
      
      // Extract design elements using Figma API
      const response = await axios.get(
        `https://api.figma.com/v1/files/${fileKey}`,
        {
          headers: {
            "X-Figma-Token": FIGMA_API_KEY
          }
        }
      );
      
      // Get image renders to help with visual analysis
      const documentId = response.data.document.id;
      const imageResponse = await axios.get(
        `https://api.figma.com/v1/images/${fileKey}?ids=${documentId}&scale=2`,
        {
          headers: {
            "X-Figma-Token": FIGMA_API_KEY
          }
        }
      );
      
      if (imageResponse.data.images && imageResponse.data.images[documentId]) {
        setDesignSnapshot(imageResponse.data.images[documentId]);
      }
      
      // Process design elements (colors, fonts, layout)
      const document = response.data.document;
      const extractedElements = extractFigmaElements(document);
      setDesignElements(extractedElements);
    } catch (err) {
      console.error("API Error:", err);
      setError(`Error loading design: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced helper function to extract Figma design elements
  const extractFigmaElements = (document) => {
    const elements = {
      colors: [],
      fonts: [],
      textStyles: [],
      spacing: [],
      components: [],
      layout: {
        type: null,
        properties: {}
      }
    };
    
    // Recursive function to extract elements
    const extractElementsFromNode = (node, path = "") => {
      // Extract colors
      if (node.fills) {
        node.fills.forEach(fill => {
          if (fill.type === 'SOLID' && fill.color) {
            const { r, g, b, a = 1 } = fill.color;
            const rgba = `rgba(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)}, ${a})`;
            const hex = rgbaToHex(Math.round(r*255), Math.round(g*255), Math.round(b*255), a);
            
            const colorObj = {
              rgba,
              hex,
              path: path + (node.name ? ` > ${node.name}` : "")
            };
            
            // Only add if not already in the array
            if (!elements.colors.some(color => color.rgba === rgba)) {
              elements.colors.push(colorObj);
            }
          }
        });
      }
      
      // Extract text styles
      if (node.type === 'TEXT' && node.style) {
        const { fontFamily, fontWeight, fontSize, lineHeightPx, letterSpacing, textAlign, textCase } = node.style;
        
        const fontObj = {
          fontFamily,
          fontSize: `${fontSize}px`,
          fontWeight: fontWeight || 400,
          lineHeight: lineHeightPx ? `${lineHeightPx}px` : 'normal',
          letterSpacing: letterSpacing ? `${letterSpacing}px` : 'normal',
          textAlign: textAlign || 'left',
          textCase: textCase || 'normal',
          text: node.characters,
          path: path + (node.name ? ` > ${node.name}` : "")
        };
        
        elements.textStyles.push(fontObj);
        
        // Add font to fonts array if not already there
        if (!elements.fonts.includes(fontFamily)) {
          elements.fonts.push(fontFamily);
        }
      }
      
      // Extract spacing and sizing
      if (node.absoluteBoundingBox) {
        const { width, height } = node.absoluteBoundingBox;
        
        if (width && height && node.name) {
          const spacingObj = {
            name: node.name,
            width: `${Math.round(width)}px`,
            height: `${Math.round(height)}px`,
            path: path + (node.name ? ` > ${node.name}` : "")
          };
          
          elements.spacing.push(spacingObj);
        }
      }
      
      // Extract layout information
      if (node.layoutMode) {
        elements.layout.type = node.layoutMode; // 'HORIZONTAL' or 'VERTICAL'
        elements.layout.properties = {
          padding: node.paddingLeft || node.paddingRight || node.paddingTop || node.paddingBottom ? 
            {
              left: node.paddingLeft || 0,
              right: node.paddingRight || 0,
              top: node.paddingTop || 0,
              bottom: node.paddingBottom || 0
            } : null,
          itemSpacing: node.itemSpacing,
          layoutAlign: node.layoutAlign,
          path: path + (node.name ? ` > ${node.name}` : "")
        };
      }
      
      // Extract component information (buttons, cards, etc.)
      if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
        const componentObj = {
          name: node.name,
          type: node.type,
          path: path + (node.name ? ` > ${node.name}` : "")
        };
        
        elements.components.push(componentObj);
      }
      
      // Recursively process children
      if (node.children) {
        const newPath = path + (node.name ? ` > ${node.name}` : "");
        node.children.forEach(child => extractElementsFromNode(child, newPath));
      }
    };
    
    // Helper function to convert RGBA to HEX
    const rgbaToHex = (r, g, b, a = 1) => {
      const toHex = (c) => {
        const hex = c.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return `#${toHex(r)}${toHex(g)}${toHex(b)}${a < 1 ? toHex(Math.round(a * 255)) : ''}`;
    };
    
    // Start the extraction process
    extractElementsFromNode(document);
    
    return elements;
  };

  // Generate Code with Gemini AI
  const generateCode = async () => {
    setError("");
    setIsLoading(true);
    setGeneratedCode("Generating code...");
    
    if (!designElements) {
      setError("Please load a design first to extract elements.");
      setGeneratedCode("");
      setIsLoading(false);
      return;
    }
    
    try {
      // Format design elements for the AI prompt
      const designInfo = JSON.stringify(designElements);
      
      // Create prompt
      const promptText = `
        Generate complete, production-ready ${selectedLang} code that precisely matches the Figma design.
        
        === Design Elements ===
        ${designInfo}
        
        === Design Image URL ===
        ${designSnapshot ? designSnapshot : "No image available"}
        
        === Requirements ===
        1. Create responsive, pixel-perfect code that exactly matches the Figma design.
        2. Use all the extracted colors, fonts, text styles, and spacing values.
        3. Implement the exact same layout structure (flexbox/grid) as in the design.
        4. Include proper CSS with all styling details (shadows, borders, gradients, etc).
        5. For images, use placeholder divs with text "Add your image here".
        6. For links, use "#" with text showing the intended destination.
        7. Include any interactive elements like buttons, dropdowns, etc.
        8. Ensure the code is well-organized and commented.
        9. DO NOT include any placeholder text or skeleton instructions - provide COMPLETE, WORKING code.
        
        === Additional Instructions ===
        - For HTML & CSS: Provide complete HTML with embedded CSS.
        - For React: Create functional components with styled-components or CSS modules.
        - For Vue.js: Use Vue 3 composition API with scoped styles.
        - For Angular: Create components with inline styles or separate style files.
      `;
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: promptText,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            topP: 0.95,
            topK: 40
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      
      // Process and clean the response
      let codeOutput = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No code generated.";
      
      // Remove any markdown code block markers if present
      codeOutput = codeOutput.replace(/```(html|css|javascript|jsx|vue|typescript|js|react|angular)?\n/g, '');
      codeOutput = codeOutput.replace(/```$/g, '');
      
      // If HTML & CSS, ensure proper HTML structure
      if (selectedLang === "HTML & CSS" && !codeOutput.includes("<!DOCTYPE html>")) {
        codeOutput = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Figma Design Implementation</title>
    <style>
        /* Extracted Styles */
        ${extractCSSFromResponse(codeOutput)}
    </style>
</head>
<body>
    ${extractHTMLFromResponse(codeOutput)}
</body>
</html>`;
      }
      
      setGeneratedCode(codeOutput);
    } catch (err) {
      console.error("Gemini API Error:", err);
      setError(`Error generating code: ${err.message}. Make sure your API key is valid.`);
      setGeneratedCode("");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper functions to extract HTML and CSS from response
  const extractCSSFromResponse = (text) => {
    // Try to find CSS between style tags
    const styleMatch = text.match(/<style>([\s\S]*?)<\/style>/);
    if (styleMatch && styleMatch[1]) {
      return styleMatch[1].trim();
    }
    
    // Try to find CSS-like content
    const cssMatch = text.match(/(\s*[.#][a-zA-Z0-9_-]+\s*\{[\s\S]*?\})/g);
    if (cssMatch) {
      return cssMatch.join('\n');
    }
    
    return '/* No CSS extracted */';
  };
  
  const extractHTMLFromResponse = (text) => {
    // Try to find content between body tags
    const bodyMatch = text.match(/<body>([\s\S]*?)<\/body>/);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1].trim();
    }
    
    // Check if the entire text is HTML (has opening and closing tags)
    if (text.match(/<[a-z][\s\S]*>/i) && text.match(/<\/[a-z][\s\S]*>/i)) {
      // Remove any style or script tags
      return text.replace(/<style>[\s\S]*?<\/style>/g, '')
                 .replace(/<script>[\s\S]*?<\/script>/g, '')
                 .trim();
    }
    
    return '<div>/* No HTML content extracted */</div>';
  };

  // Copy Code to Clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    alert("Code copied to clipboard!");
  };

  return (
    <div className="container">
      <h1>Figma to Front-End Code</h1>
      
      {/* File Key Input */}
      <div className="input-group">
        <input
          type="text"
          placeholder="Enter Figma File Key"
          value={fileKey}
          onChange={(e) => setFileKey(e.target.value)}
        />
        <button 
          onClick={handleEmbed}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Load Design"}
        </button>
      </div>
      
      {/* Framework Selection */}
      <div className="select-group">
        <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
          <option value="HTML & CSS">HTML & CSS</option>
          <option value="React">React</option>
          <option value="Vue.js">Vue.js</option>
          <option value="Angular">Angular</option>
        </select>
        <button 
          onClick={generateCode}
          disabled={isLoading || !designElements}
          className="generate-btn"
        >
          {isLoading ? "Generating..." : "Generate Code"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      
      {/* Design Preview */}
      {embedUrl && (
        <div className="preview-container">
          <h3>Design Preview</h3>
          <iframe title="Design Preview" width="100%" height="500" src={embedUrl} allowFullScreen />
        </div>
      )}
      
      {/* Extracted Design Elements */}
      {designElements && (
        <div className="elements-container">
          <h3>Extracted Design Elements</h3>
          <div className="elements-grid">
            <div className="element-group">
              <h4>Colors</h4>
              <div className="color-swatches">
                {designElements.colors.map((color, index) => (
                  <div key={index} 
                       className="color-swatch" 
                       style={{ backgroundColor: color.rgba }} 
                       title={`${color.hex} - ${color.path}`}>
                  </div>
                ))}
                {designElements.colors.length === 0 && <p>No colors extracted</p>}
              </div>
            </div>
            <div className="element-group">
              <h4>Fonts</h4>
              <ul className="font-list">
                {designElements.fonts.map((font, index) => (
                  <li key={index}>{font}</li>
                ))}
                {designElements.fonts.length === 0 && <p>No fonts extracted</p>}
              </ul>
            </div>
            <div className="element-group">
              <h4>Text Styles</h4>
              <ul className="text-styles-list">
                {designElements.textStyles.slice(0, 5).map((style, index) => (
                  <li key={index} style={{
                    fontFamily: style.fontFamily || 'inherit',
                    fontSize: style.fontSize || 'inherit',
                    fontWeight: style.fontWeight || 'inherit'
                  }}>
                    {style.text.substring(0, 20)}{style.text.length > 20 ? '...' : ''}
                  </li>
                ))}
                {designElements.textStyles.length > 5 && <li>...and {designElements.textStyles.length - 5} more</li>}
                {designElements.textStyles.length === 0 && <p>No text styles extracted</p>}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Generated Code */}
      {generatedCode && (
        <div className="code-container">
          <div className="code-header">
            <h3>Generated Code</h3>
            <div className="code-actions">
              <button onClick={copyToClipboard}>Copy Code</button>
              <button onClick={generateCode} disabled={isLoading}>
                {isLoading ? "Regenerating..." : "Regenerate"}
              </button>
              <button onClick={() => setGeneratedCode("")} disabled={isLoading}>
                Clear
              </button>
            </div>
          </div>
          <textarea value={generatedCode} readOnly />
          {generatedCode && (
            <div className="feedback-buttons">
              <button className="feedback-btn like-btn">I like this response</button>
              <button className="feedback-btn dislike-btn" onClick={generateCode}>
                I didn't like this response, regenerate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;