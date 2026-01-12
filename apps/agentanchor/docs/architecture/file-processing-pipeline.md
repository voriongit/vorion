# File Processing Pipeline Architecture

**Version:** 1.0
**Last Updated:** 2025-11-23
**Architect:** BMAD Master Agent
**Status:** Design

---

## Executive Summary

This document defines the architecture for file upload, processing, storage, and intelligent context injection into bot conversations, enabling multimodal AI interactions.

**Key Goals:**
- Support multiple file types (PDF, DOCX, images, code, CSV, JSON, etc.)
- Secure file storage with user isolation
- Efficient processing pipeline
- Intelligent context injection
- Performance: <3s for file processing
- Cost-effective storage and processing

---

## Architecture Overview

### File Upload to Bot Response Flow

```
┌─────────────┐
│   User      │
│ Upload File │
└──────┬──────┘
       │ 1. File Selection
       ▼
┌──────────────────┐
│  Upload UI       │
│  (Drag & Drop)   │
└──────┬───────────┘
       │ 2. Validate Client-Side
       ▼
┌──────────────────┐
│  Upload API      │
│ /api/files/upload│
└──────┬───────────┘
       │ 3. Validate Server-Side
       │ 4. Upload to Storage
       ▼
┌──────────────────┐
│ Supabase Storage │
│ (conversation-   │
│  files bucket)   │
└──────┬───────────┘
       │ 5. Trigger Processing
       ▼
┌───────────────────────────────┐
│   File Processing Pipeline    │
│  ┌────────┐  ┌────────┐       │
│  │  PDF   │  │ Image  │       │
│  │Extract │  │ Vision │       │
│  └────────┘  └────────┘       │
│  ┌────────┐  ┌────────┐       │
│  │ DOCX   │  │  Code  │       │
│  │Extract │  │ Parse  │       │
│  └────────┘  └────────┘       │
└───────┬───────────────────────┘
        │ 6. Extract Content
        ▼
┌──────────────────┐
│  Context Builder │
│  (Smart Chunking)│
└──────┬───────────┘
        │ 7. Attach to Message
        ▼
┌──────────────────┐
│   Chat API       │
│  (with file      │
│   context)       │
└──────┬───────────┘
        │ 8. Claude API
        ▼
┌──────────────────┐
│ Bot Response     │
│ (file-aware)     │
└──────────────────┘
```

---

## Component Architecture

### 1. File Upload API

**`app/api/files/upload/route.ts`:**

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FileProcessor } from '@/lib/file-processor';

const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = {
  // Documents
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'application/json': '.json',
  'text/csv': '.csv',

  // Images
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',

  // Code
  'text/javascript': '.js',
  'text/typescript': '.ts',
  'text/x-python': '.py',
  'text/x-java': '.java',
  'text/x-c': '.c',
  'text/x-rust': '.rs',
};

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const conversationId = formData.get('conversationId') as string;

    if (!file || !conversationId) {
      return NextResponse.json(
        { error: 'File and conversationId required' },
        { status: 400 }
      );
    }

    // Validation: File size
    if (file.size > FILE_SIZE_LIMIT) {
      return NextResponse.json(
        { error: `File too large. Max ${FILE_SIZE_LIMIT / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validation: File type (server-side, don't trust client MIME)
    const fileType = await detectFileType(file);
    if (!ALLOWED_TYPES[fileType]) {
      return NextResponse.json(
        { error: 'File type not supported' },
        { status: 400 }
      );
    }

    // Verify user owns conversation
    const { data: conversation } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = sanitizeFilename(file.name);
    const storagePath = `${session.user.id}/${conversationId}/${timestamp}-${sanitizedName}`;

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('conversation-files')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) throw uploadError;

    // Generate signed URL (1 hour expiry)
    const { data: urlData } = await supabase
      .storage
      .from('conversation-files')
      .createSignedUrl(storagePath, 3600);

    // Process file to extract content
    const processor = new FileProcessor();
    const processedData = await processor.process({
      file,
      fileType,
      storagePath,
      url: urlData.signedUrl,
    });

    // Create file record
    const fileRecord = {
      id: crypto.randomUUID(),
      name: file.name,
      type: fileType,
      size: file.size,
      storagePath: storagePath,
      url: urlData.signedUrl,
      extracted_text: processedData.extractedText,
      metadata: processedData.metadata,
    };

    return NextResponse.json({
      success: true,
      file: fileRecord,
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

async function detectFileType(file: File): Promise<string> {
  // Use magic number detection for security
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer).slice(0, 12);

  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }

  // DOCX: PK (ZIP archive, need deeper check)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  // Fallback to reported MIME type (less secure)
  return file.type;
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .slice(0, 255);
}
```

---

### 2. File Processing Engine

**`lib/file-processor.ts`:**

```typescript
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import Anthropic from '@anthropic-ai/sdk';

interface ProcessingInput {
  file: File;
  fileType: string;
  storagePath: string;
  url: string;
}

interface ProcessingOutput {
  extractedText?: string;
  metadata: Record<string, any>;
  chunks?: TextChunk[];
  imageAnalysis?: string;
}

interface TextChunk {
  content: string;
  start: number;
  end: number;
  type: 'paragraph' | 'code' | 'heading' | 'list';
}

export class FileProcessor {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async process(input: ProcessingInput): Promise<ProcessingOutput> {
    const { fileType } = input;

    if (fileType === 'application/pdf') {
      return await this.processPDF(input);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await this.processDOCX(input);
    } else if (fileType.startsWith('image/')) {
      return await this.processImage(input);
    } else if (fileType === 'text/plain' || fileType === 'text/markdown') {
      return await this.processText(input);
    } else if (fileType === 'application/json') {
      return await this.processJSON(input);
    } else if (fileType === 'text/csv') {
      return await this.processCSV(input);
    } else if (this.isCodeFile(fileType)) {
      return await this.processCode(input);
    }

    return { metadata: { fileType } };
  }

  private async processPDF(input: ProcessingInput): Promise<ProcessingOutput> {
    const buffer = await input.file.arrayBuffer();
    const data = await pdf(Buffer.from(buffer));

    return {
      extractedText: data.text,
      metadata: {
        pages: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
      },
      chunks: this.chunkText(data.text),
    };
  }

  private async processDOCX(input: ProcessingInput): Promise<ProcessingOutput> {
    const buffer = await input.file.arrayBuffer();
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });

    return {
      extractedText: result.value,
      metadata: {
        wordCount: result.value.split(/\s+/).length,
      },
      chunks: this.chunkText(result.value),
    };
  }

  private async processImage(input: ProcessingInput): Promise<ProcessingOutput> {
    // Use Claude's vision capabilities
    const imageBuffer = await input.file.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: input.fileType as any,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: 'Describe this image in detail. Include any text visible in the image.',
            },
          ],
        },
      ],
    });

    const description = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    return {
      imageAnalysis: description,
      extractedText: description,
      metadata: {
        width: 0, // Could extract from image metadata
        height: 0,
        format: input.fileType,
      },
    };
  }

  private async processText(input: ProcessingInput): Promise<ProcessingOutput> {
    const text = await input.file.text();

    return {
      extractedText: text,
      metadata: {
        lines: text.split('\n').length,
        charCount: text.length,
      },
      chunks: this.chunkText(text),
    };
  }

  private async processJSON(input: ProcessingInput): Promise<ProcessingOutput> {
    const text = await input.file.text();
    const json = JSON.parse(text);

    // Pretty-print JSON for better readability
    const formatted = JSON.stringify(json, null, 2);

    return {
      extractedText: formatted,
      metadata: {
        keys: Object.keys(json),
        structure: this.analyzeJSONStructure(json),
      },
    };
  }

  private async processCSV(input: ProcessingInput): Promise<ProcessingOutput> {
    const text = await input.file.text();
    const lines = text.split('\n');
    const headers = lines[0]?.split(',') || [];

    // Convert to markdown table for better display
    const markdown = this.csvToMarkdown(text);

    return {
      extractedText: markdown,
      metadata: {
        rows: lines.length - 1, // Excluding header
        columns: headers.length,
        headers,
      },
    };
  }

  private async processCode(input: ProcessingInput): Promise<ProcessingOutput> {
    const code = await input.file.text();

    // Detect language
    const language = this.detectLanguage(input.file.name);

    return {
      extractedText: code,
      metadata: {
        language,
        lines: code.split('\n').length,
      },
      chunks: this.chunkCode(code, language),
    };
  }

  // Utility: Chunk text into manageable pieces
  private chunkText(text: string, maxChunkSize: number = 2000): TextChunk[] {
    const chunks: TextChunk[] = [];
    const paragraphs = text.split(/\n\n+/);

    let currentChunk = '';
    let startPos = 0;

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          start: startPos,
          end: startPos + currentChunk.length,
          type: 'paragraph',
        });
        currentChunk = para;
        startPos += currentChunk.length;
      } else {
        currentChunk += '\n\n' + para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        start: startPos,
        end: startPos + currentChunk.length,
        type: 'paragraph',
      });
    }

    return chunks;
  }

  private chunkCode(code: string, language: string): TextChunk[] {
    // Simple chunking by functions/classes
    // Could use tree-sitter for proper AST parsing
    const chunks: TextChunk[] = [];
    const lines = code.split('\n');
    let currentChunk: string[] = [];
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Simple heuristic: New function/class definition
      if (line.match(/^(function|class|def|pub fn|fn|const\s+\w+\s*=\s*\()/)) {
        if (currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.join('\n'),
            start: startLine,
            end: i,
            type: 'code',
          });
          currentChunk = [];
          startLine = i;
        }
      }

      currentChunk.push(line);
    }

    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        start: startLine,
        end: lines.length,
        type: 'code',
      });
    }

    return chunks;
  }

  private analyzeJSONStructure(json: any, depth: number = 0): string {
    if (depth > 3) return '...'; // Prevent deep recursion

    if (Array.isArray(json)) {
      return `Array[${json.length}]`;
    } else if (typeof json === 'object' && json !== null) {
      const keys = Object.keys(json).slice(0, 5); // Show first 5 keys
      return `Object{${keys.join(', ')}${Object.keys(json).length > 5 ? '...' : ''}}`;
    } else {
      return typeof json;
    }
  }

  private csvToMarkdown(csv: string): string {
    const lines = csv.split('\n');
    if (lines.length === 0) return '';

    const headers = lines[0].split(',');
    const rows = lines.slice(1);

    let markdown = '| ' + headers.join(' | ') + ' |\n';
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    for (const row of rows) {
      if (row.trim()) {
        markdown += '| ' + row.split(',').join(' | ') + ' |\n';
      }
    }

    return markdown;
  }

  private detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      rs: 'rust',
      go: 'go',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
    };
    return langMap[ext || ''] || 'unknown';
  }

  private isCodeFile(fileType: string): boolean {
    return fileType.startsWith('text/x-') ||
           fileType === 'text/javascript' ||
           fileType === 'text/typescript';
  }
}
```

---

### 3. Context Injection

**`lib/context-builder.ts`:**

```typescript
interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  extracted_text?: string;
  metadata?: Record<string, any>;
  chunks?: TextChunk[];
  imageAnalysis?: string;
}

export class ContextBuilder {
  buildFileContext(attachments: FileAttachment[]): string {
    if (attachments.length === 0) return '';

    let context = '\n\n## Attached Files\n\n';

    for (const file of attachments) {
      context += `### ${file.name} (${this.formatFileType(file.type)})\n\n`;

      if (file.imageAnalysis) {
        context += `**Image Description**: ${file.imageAnalysis}\n\n`;
      }

      if (file.extracted_text) {
        // Truncate if too long
        const maxLength = 5000;
        let text = file.extracted_text;

        if (text.length > maxLength) {
          text = text.substring(0, maxLength) + '\n\n[... content truncated ...]';
        }

        context += '```\n' + text + '\n```\n\n';
      }

      if (file.metadata) {
        context += `**Metadata**: ${JSON.stringify(file.metadata)}\n\n`;
      }
    }

    return context;
  }

  private formatFileType(mimeType: string): string {
    const typeMap: Record<string, string> = {
      'application/pdf': 'PDF Document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
      'text/plain': 'Text File',
      'image/png': 'PNG Image',
      'image/jpeg': 'JPEG Image',
      'application/json': 'JSON Data',
      'text/csv': 'CSV Data',
    };

    return typeMap[mimeType] || mimeType;
  }
}
```

---

### 4. Integration with Chat API

**Modified `app/api/chat/route.ts`:**

```typescript
export async function POST(req: NextRequest) {
  // ... existing auth and setup ...

  const { botId, message, conversationId, messages, attachments } = await req.json();

  // Build context from attachments
  const contextBuilder = new ContextBuilder();
  const fileContext = contextBuilder.buildFileContext(attachments || []);

  // Augment user message with file context
  const enhancedMessage = message + fileContext;

  // Call Claude
  const messageStream = await anthropic.messages.create({
    model: bot.model,
    max_tokens: bot.max_tokens,
    temperature: bot.temperature,
    system: bot.system_prompt,
    messages: [
      ...messages,
      { role: 'user', content: enhancedMessage },
    ],
    stream: true,
  });

  // ... stream response ...
}
```

---

## Security & Privacy

1. **File Isolation**: RLS policies ensure users only access their files
2. **Virus Scanning**: Future integration with ClamAV or similar
3. **Content Filtering**: Reject files with malicious content
4. **Size Limits**: Prevent storage abuse
5. **Signed URLs**: Time-limited access (1-hour expiry)

---

## Performance Optimizations

1. **Lazy Processing**: Process files on-demand, not immediately
2. **Caching**: Cache extracted text in database
3. **Background Jobs**: Use queue for large file processing
4. **Streaming**: Stream large file responses
5. **CDN**: Serve files via Supabase CDN

---

## Cost Analysis

**Storage Costs (Supabase):**
- $0.021/GB/month
- Free tier: 1GB

**Processing Costs:**
- Claude Vision: ~$3/1K images
- Text extraction: Minimal (library-based)

**Recommendations:**
- Implement retention policy (delete files after 30 days)
- Compress images before storage
- Limit file uploads per user tier

---

## Testing Strategy

1. Upload various file types
2. Test size limits
3. Security: Path traversal, malicious files
4. Performance: Large files (10MB)
5. Error handling: Corrupt files

---

## Future Enhancements

1. **OCR**: Extract text from scanned images
2. **Audio/Video**: Transcription support
3. **File Search**: Search across all uploaded files
4. **Version Control**: Track file changes
5. **Collaborative Editing**: Real-time file collaboration
