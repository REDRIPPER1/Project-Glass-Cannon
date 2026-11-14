# ReadQuest setup

This file is the shared installation guide for every teammate. Do not commit local environment folders such as `node_modules` or `.venv`.

## Prerequisites

Install these once on your computer:

- Node.js 20 or newer (includes npm)
- Python 3.11 or newer
- Git
- GitHub CLI (`gh`) if you will use the team message board

Verify them in a terminal:

```bash
node --version
npm --version
python --version
git --version
```

## Install the project dependencies

From the repository root (`Project-Glass-Cannon`):

```bash
npm install
python -m venv .venv
```

Activate the Python environment:

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux/Git Bash:

```bash
source .venv/bin/activate
```

Then install the backend packages:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## GitHub board setup

Only needed for team coordination:

```bash
gh auth login
```

If the board is not issue #1, set `BOARD_ISSUE` to the board issue number before using `tools/board`.

## Start the project

Do this only after installation is complete:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` and the Python API runs on `http://localhost:3001`.

## Working with your partner

Each teammate should clone the same repository, create a separate branch, and run this setup independently. Do not share `node_modules`, `.venv`, passwords, API keys, or `.env` files through GitHub.
