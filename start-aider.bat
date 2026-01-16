@echo off
setlocal

:: 1. Set the model based on your input
set MODEL=openrouter/x-ai/grok-code-fast-1
if "%1"=="ui" set MODEL=openrouter/qwen/qwen3-coder-flash
if "%1"=="pro" set MODEL=openrouter/anthropic/claude-3.5-sonnet

:: 2. Display what is happening
echo Starting Aider...
if "%1"=="ui" echo Mode: UI and Responsive (Qwen3)
if "%1"=="pro" echo Mode: Pro Reasoning (Claude 3.5)
if "%1"=="" echo Mode: Default Agentic (Grok)

:: 3. Run Aider
aider --model %MODEL% --architect --cache-prompts --map-tokens 1024 --env-file .env

endlocal