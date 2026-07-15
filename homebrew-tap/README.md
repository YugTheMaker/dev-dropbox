# homebrew-tap 📦

This is the official Homebrew Tap for **Dev Dropbox**. It allows users to install Dev Dropbox via Homebrew and bypasses macOS Gatekeeper warnings without requiring a paid Apple Developer Account.

## Setup & Publishing Instructions

Follow these simple steps to publish this tap on GitHub:

1. **Create a GitHub Repository**:
   - Go to your GitHub dashboard and create a new **public** repository named **`homebrew-tap`**.

2. **Initialize and Push**:
   - Run these commands in your terminal to publish this tap:
     ```bash
     cd homebrew-tap
     git init
     git add .
     git commit -m "Initial Homebrew Cask for Dev Dropbox"
     git branch -M main
     git remote add origin https://github.com/YugTheMaker/homebrew-tap.git
     git push -u origin main
     ```

3. **Install Commands**:
   Once pushed, any user can install Dev Dropbox by running:
   ```bash
   brew install --cask YugTheMaker/tap/dev-dropbox
   ```
