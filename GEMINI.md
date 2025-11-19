# Project: bolt.diy - AI-Powered Full-Stack Web Development Environment

## 1. Project Overview

**bolt.diy** is an open-source, in-browser Integrated Development Environment (IDE) that leverages Large Language Models (LLMs) to power full-stack web development. It allows users to generate and modify NodeJS-based applications directly in the browser, providing an AI-assisted coding experience.

The project is a complex, full-stack application with several key components:

*   **Frontend:** A [Remix](https://remix.run/) application built with [React](https://react.dev/) and styled with [UnoCSS](https://unocss.dev/). It provides the main user interface, including the code editor, terminal, and chat panel.
*   **In-Browser Environment:** Utilizes the [WebContainer API](https://webcontainers.io/) to run a complete Node.js environment entirely within the browser. This is the core technology that enables code execution and terminal interaction without a traditional backend.
*   **Backend (Serverless):** [Cloudflare Workers](https://workers.cloudflare.com/) are used for server-side logic, acting as a proxy and handling API requests. The application is designed to be deployed on [Cloudflare Pages](https://pages.cloudflare.com/).
*   **Desktop Application:** An optional [Electron](https://www.electronjs.org/) wrapper allows the web application to be packaged and run as a standalone desktop app.
*   **AI Integration:** The [Vercel AI SDK](https://sdk.vercel.ai/) is used to integrate with a wide variety of LLM providers (OpenAI, Gemini, Anthropic, Ollama, etc.), which are the "brains" behind the code generation.
*   **Build Tooling:** [Vite](https://vitejs.dev/) is used for building and serving the Remix frontend, with [Vitest](https://vitest.dev/) for testing.

## 2. Building and Running

The project uses `pnpm` as its package manager.

### Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version, >=18.18.0)
*   [pnpm](https://pnpm.io/installation)

### Development

To run the application in development mode:

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Start the development server:**
    ```bash
    pnpm run dev
    ```
    The application will be available at `http://localhost:5173`.

### Production Build

To create a production build:

```bash
pnpm run build
```

The output will be generated in the `build/client` directory.

To preview the production build locally:

```bash
pnpm run preview
```

This command builds the project and then serves it using `wrangler`, simulating the Cloudflare Pages environment.

### Docker

The project includes Docker support for a containerized setup.

1.  **Build the development image:**
    ```bash
    npm run dockerbuild
    ```

2.  **Run the development container:**
    ```bash
    docker compose --profile development up
    ```

### Electron App

To build the Electron desktop application:

*   **For macOS:** `pnpm run electron:build:mac`
*   **For Windows:** `pnpm run electron:build:win`
*   **For Linux:** `pnpm run electron:build:linux`
*   **For all platforms:** `pnpm run electron:build:dist`

## 3. Key Commands

Here is a summary of the most important scripts defined in `package.json`:

*   `pnpm run dev`: Starts the Vite development server for the Remix app.
*   `pnpm run build`: Builds the application for production.
*   `pnpm run start`: Serves the production build locally using Cloudflare Wrangler.
*   `pnpm run preview`: A shorthand for building and then starting the app.
*   `pnpm test`: Runs the unit and integration tests with Vitest.
*   `pnpm run typecheck`: Performs a static type check using TypeScript.
*   `pnpm run lint`: Lints the codebase with ESLint.
*   `pnpm run lint:fix`: Lints the code and automatically fixes issues.
*   `pnpm run deploy`: Deploys the application to Cloudflare Pages.

## 4. Development Conventions

*   **Package Manager:** `pnpm` is the required package manager.
*   **Linting & Formatting:** The project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) for code formatting. A pre-commit hook is configured with Husky to ensure code quality before commits.
*   **Testing:** [Vitest](https://vitest.dev/) is used for testing. Test files are located alongside the source files.
*   **Styling:** [UnoCSS](https://unocss.dev/) is used for utility-first CSS. Configuration is in `uno.config.ts`.
*   **Environment Variables:** The application is heavily configured via environment variables (e.g., in a `.env` file). This includes API keys for LLM providers and the `BASE_PATH` for deployment under a sub-directory.
*   **Cross-Origin Isolation:** The Vite development server is specifically configured with `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers. These are essential for the `WebContainer API` to function correctly.
