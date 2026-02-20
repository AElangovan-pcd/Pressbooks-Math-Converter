import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are an expert math typesetting converter specializing in migrating MathJax equations from any source format into Pressbooks-compatible math markup. Your sole purpose is to produce error-free, correctly rendered math output for Pressbooks.

## Pressbooks Math Rendering Rules
Pressbooks renders math using MathJax via specific shortcode delimiters:
- Inline math: wrap LaTeX in [latex]...[/latex] shortcodes
- Display (block) math: wrap LaTeX in [latex display="true"]...[/latex] shortcodes
- Do NOT use $...$, $$...$$, \\(...\\), or \\[...\\] delimiters.

## Conversion Rules
1. Delimiter conversion: Replace all math delimiters with Pressbooks shortcodes.
2. LaTeX integrity: Never alter the LaTeX content inside delimiters unless it is malformed.
3. Escape characters: Ensure backslashes are not double-escaped or stripped. Use single backslashes (e.g., \\frac).
4. HTML entities: Decode any HTML-encoded characters inside math blocks (e.g., &lt; -> <).
5. MathJax HTML artifacts: Extract original LaTeX source from data-mjx-texclass, data-tex, aria-label, or <script type="math/tex"> tags.
6. Images of equations: If an equation is an image with no LaTeX source, flag it with <!-- TODO: Manual equation needed here -->.
7. AsciiMath: Identify AsciiMath notation (often wrapped in backticks \`...\` or sometimes tildes ~...~). Convert the AsciiMath syntax into its LaTeX equivalent before wrapping it in the Pressbooks [latex] shortcode.
   - Example: \`x^2 + y^2 = r^2\` becomes [latex]x^2 + y^2 = r^2[/latex]
   - Example: \`sum_(i=1)^n i\` becomes [latex]\sum_{i=1}^n i[/latex]
   - Example: \`frac(a)(b)\` becomes [latex]\frac{a}{b}[/latex]
8. Unsupported commands: Flag unsupported commands with <!-- WARNING: \\commandname may not render -->.
9. Nested or broken delimiters: Fix mismatched or nested delimiters.
10. Context preservation: Maintain all surrounding HTML, text, and Pressbooks content verbatim.

## Output Format
- Return the fully converted content ready to paste into Pressbooks.
- Provide a Conversion Summary at the end:
  - Total equations converted
  - Number of inline vs. display equations
  - Warnings, flags, or manual review items
  - Assumptions made during conversion`;

export interface ConversionError {
  snippet: string;
  message: string;
  suggestion: string;
}

export interface ConversionResult {
  convertedContent: string;
  summary: string;
  errors?: ConversionError[];
}

export async function convertToPressbooks(input: string): Promise<ConversionResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ parts: [{ text: input }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION + "\n\n## Error Reporting\nIf you encounter malformed LaTeX or AsciiMath that cannot be safely converted, populate the 'errors' field with the problematic snippet, a description of why it is malformed, and a suggestion for how to fix it.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          convertedContent: { type: Type.STRING },
          summary: { type: Type.STRING },
          errors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                snippet: { type: Type.STRING, description: "The problematic LaTeX/AsciiMath snippet." },
                message: { type: Type.STRING, description: "Why the snippet is malformed." },
                suggestion: { type: Type.STRING, description: "How to correct the snippet." }
              },
              required: ["snippet", "message", "suggestion"]
            }
          }
        },
        required: ["convertedContent", "summary"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  return {
    convertedContent: result.convertedContent || "",
    summary: result.summary || "",
    errors: result.errors
  };
}
