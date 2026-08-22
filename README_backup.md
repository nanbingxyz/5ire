<div align="center">
  <a href="https://github.com/nanbingxyz/5ire">
    <img src="https://5ire.app/logo.png" alt="Logo" width="120">
  </a>
  <br />
  <span>(pronounced "fai-er")</span>
   <h1>A Sleek AI Assistant & MCP Client</h1>
   <div>
    <a href="https://modelcontextprotocol.io/clients" target="_blank"><img src="https://badge.mcpx.dev/?type=client" /></a>
    <img src="https://badge.mcpx.dev/?type=client&features=tools,prompts" />
    <a href="https://discord.gg/ADfBTGd5jd"><img src="https://dcbadge.limes.pink/api/server/ADfBTGd5jd?style=flat&theme=clean" alt="5ire discord server"/></a>
    <img src="https://img.shields.io/badge/price-free-brightgreen.svg"/>
    <a href="https://linkedin.com/in/nanbing" target="_blank"><img src="https://custom-icon-badges.demolab.com/badge/LinkedIn-0A66C2?logo=linkedin-white&logoColor=fff" alt="follow on LinkedIn"></a>
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
     <a href="https://github.com/nanbingxyz/5ire/graphs/commit-activity" target="_blank">
        <img alt="Commits last month" src="https://img.shields.io/github/commit-activity/m/nanbingxyz/5ire?labelColor=%20%2332b583&color=%20%2312b76a"></a>
     <a href="https://github.com/nanbingxyz/5ire/issues" target="_blank">
        <img alt="Issues closed" src="https://img.shields.io/github/issues-search?query=repo%3Ananbingxyz%2F5ire%20is%3Aclosed&label=issues%20closed&labelColor=%20%237d89b0&color=%20%235d6b98"></a>
     <a href="https://mseep.ai/app/92bbc79d-4b4d-4707-8d43-2d3d8ebb4fa8" target="_blank"><img src="https://mseep.ai/badge.svg" alt="Verified on MseeP"/></a>
  </div>
   <br />
  <img src="https://github.com/user-attachments/assets/e622e1da-09b9-4212-b71c-ad9d39bf3cd5" width="100%"/>
  <br />
  <p>
    <br />
    <div style="display:flex;justify-content:space-around;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:15px;">
    <span style="font-size:12px;">OpenAI</span>
    <span style="font-size:12px;">/ Azure</span>
    <span style="font-size:12px;">/ Anthropic</span>
    <span style="font-size:12px;">/ Google</span>
    <span style="font-size:12px;">/ Mistral</span>
    <span style="font-size:12px;">/ Doubao</span>
    <span style="font-size:12px;">/ Grok</span>
    <span style="font-size:12px;">/ DeepSeek</span>
    <span style="font-size:12px;">/ Ollama</span>
  </div>
    <br />
    <a href="https://x.com/intent/follow?screen_name=1ronben">Twitter</a>
    ·
    <a href="https://github.com/nanbingxyz/5ire/releases/latest">Releases</a>
  </p>
  <div><a href="https://buymeacoffee.com/ironben"><img src="https://github.com/user-attachments/assets/2265e2d6-2a17-4a48-b779-52a925261135" style="width:200px"/></a></div>
   <br />
<video src="https://github.com/user-attachments/assets/741b23d3-31df-4749-bde4-103e2d415953.mp4"></video>
</div>
<br />

### Before to activating tools feature, ensure the following components are installed:

- Python
- Node.js
- uv (Python package manager)

These components are required as they constitute the runtime environment for the MCP Server. If you don't anticipate using the tools feature immediately, you may choose to skip this installation step and complete it later when the need arises.

For detailed installation instructions, please see our [Installation Guide](INSTALLATION.md).

<br/>

### 💪 Getting involved

If you want to contribute code to 5ire or develop your own apps based on 5ire, start with the [Development Setup Guide](DEVELOPMENT.md).

Visit [Wiki](https://deepwiki.com/nanbingxyz/5ire) for more details.

**🚀 To integrate 5ire's one-click server installation into your website, see the** [One-Click Server Installation Integration Guide](https://github.com/nanbingxyz/5ire/wiki/One%E2%80%90Click-Server-Installation-Integration-Guide).

<br/>

### 💬 Community

**[Join the Discord](https://discord.gg/ADfBTGd5jd)**,  By joining, you'll get:

- Faster responses to your questions and issues
- Direct input on new features and improvements
- A place to share ideas, tips, and feedback with other 5ire users
- Opportunities to co-build and shape the future of 5ire together

<br/>

# Features

## ⚒️ Support Tools via MCP Servers

MCP is an open protocol that standardizes how applications provide context to LLMs. Think of MCP like a USB-C port for AI applications. Just as USB-C provides a standardized way to connect your devices to various peripherals and accessories, MCP provides a standardized way to connect AI models to different data sources and tools.

With tools, you can access the file system, obtain system information, interact with databases, access remote data, and more, rather than just having a simple conversation.

https://github.com/user-attachments/assets/5aa98f2b-c26d-435e-8196-73fa414066eb

We have created an open [marketplace for MCP Servers](https://github.com/nanbingxyz/mcpsvr). it empowers users to discover exceptional tools while offering a streamlined process for sharing their own MCP server creations.

https://github.com/user-attachments/assets/be66c30e-bb29-4dfe-9f25-8d396470ed60

### Pre-configured MCP Server Examples

Here are some popular MCP servers you can easily configure in 5ire:

#### You.com Search & Research
Access current web search, URL content extraction, and AI research through You.com's MCP server:

```json
{
  "mcpServers": {
    "you-com": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://api.you.com/mcp", "--header", "Authorization: Bearer ${YDC_API_KEY}"],
      "env": {
        "YDC_API_KEY": "your_api_key_here"
      }
    },
    "you-com-free": {
      "command": "npx", 
      "args": ["-y", "mcp-remote", "https://api.you.com/mcp?profile=free"]
    },
    "you-com-finance": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://api.you.com/mcp?tools=you-finance", "--header", "Authorization: Bearer ${YDC_API_KEY}"],
      "env": {
        "YDC_API_KEY": "your_api_key_here"
      }
    },
    "you-docs": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://you.com/docs/_mcp/server"]
    }
  }
}
```

- **you-com**: Full authenticated access with tools: `you-search`, `you-contents`, `you-research`, `you-discover`, `you-balance` (requires [You.com API key](https://you.com/platform/api-keys?utm_source=5ire&utm_medium=mcp-integration&utm_campaign=2026-08-oss-integrations))
- **you-com-free**: Keyless web search with tools: `you-search` (100 searches/day)
- **you-com-finance**: Optional finance-enabled profile with tools: `you-search`, `you-contents`, `you-research`, `you-discover`, `you-balance`, `you-finance` (requires API key)
- **you-docs**: You.com documentation search with tools: `searchDocs`

> **Note**: The `you-finance` tool is not enabled by default on the main `you-com` profile. To access finance data and market research capabilities, use the `you-com-finance` profile or add `?tools=you-finance` to your MCP server URL.

## 💡 Local Knowledge Base

We have integrated the bge-m3 as our local embedding model, which excels in multilingual vectorization. 5ire now supports parsing and vectorization of docx, xlsx, pptx, pdf, txt, and csv documents, enabling storage of these vectors to power robust Retrieval-Augmented Generation (RAG) capabilities locally.

![Local Knowledge Base Screenshot](https://5ire.app/knowledge.png)

## 📈 Usage Analytics

By keeping track of your API usage and spending, you can gain a better understanding of how much you're spending on the API and make informed decisions to optimize your use of the service.

![Usage Analytics Screenshot](https://5ire.app/analytics.png)

## ✨ Prompts Library

The prompt library provides an effective way to create and organize your own prompts. These prompts are highly versatile, thanks to their support for variables.

![Prompts Library Screenshots](https://5ire.app/prompts.png)

## 🔖 Bookmarks

You can bookmark each conversation, and even if the original messages are deleted, the saved bookmarked content remains unaffected.
![Bookmarks Screenshot](https://5ire.app/bookmarks.png)

## 🔍 Quick Search

You can perform keyword searches across all conversations, quickly pinpointing the information you need.
![Search Screenshot](https://5ire.app/search.png)

> [!TIP]
> Since 5ire uses native dependencies, it needs to be packaged on the corresponding platform. If it is on Mac OS, you may also need to configure APPLE_TEAM_ID, APPLE_ID, and APPLE_ID_PASS for notarization to avoid security alerts.

<hr/>

## Discover Exceptional MCP Servers

[MCPSvr](https://github.com/nanbingxyz/mcpsvr), a community-driven directory of MCP servers, empowers developers to discover exceptional tools while offering a streamlined process for sharing their own MCP server creations.