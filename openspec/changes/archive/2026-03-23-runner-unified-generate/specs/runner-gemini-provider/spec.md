## ADDED Requirements

### Requirement: Gemini Pro agent loop
`generate.ts` SHALL support `--provider google-gemini` in `agent` mode, driving generation via the Google Generative AI SDK (`@google/genai`) with native function calling. The same four tools as the OpenAI loop (read_file, write_file, list_files, bash) SHALL be declared and executed.

#### Scenario: Gemini agent loop completes generation
- **WHEN** `--mode agent --provider google-gemini --model gemini-2.5-pro` is invoked with a valid `GOOGLE_API_KEY`
- **THEN** the agent loop sends the task prompt, receives function calls, executes tools, and continues until no function calls are returned

#### Scenario: GOOGLE_API_KEY is required
- **WHEN** `--provider google-gemini` and `GOOGLE_API_KEY` is unset
- **THEN** the script exits non-zero with a message indicating the missing key

#### Scenario: Tool calls executed via shared execTool
- **WHEN** the Gemini model returns a functionCall part for read_file, write_file, list_files, or bash
- **THEN** `execTool()` is called and the result is returned as a functionResponse part in the next turn

#### Scenario: Token usage tracked
- **WHEN** the Gemini loop completes
- **THEN** input and output token counts from the response `usageMetadata` are accumulated and written to `generation-meta.json`

#### Scenario: generation-meta.json written on completion
- **WHEN** the Gemini agent loop finishes (success or max-turns)
- **THEN** `generation-meta.json` is written with fileCount, model, inputTokens, outputTokens, timeSeconds, and turns fields

### Requirement: Gemini model ID support
`generate.ts` SHALL accept any `gemini-*` model ID via `--model` and pass it directly to the Google Gen AI SDK.

#### Scenario: Model ID passed through
- **WHEN** `--model gemini-2.5-pro` is passed
- **THEN** the SDK is initialised with model `gemini-2.5-pro`

#### Scenario: Default Gemini model
- **WHEN** `--provider google-gemini` is set and `--model` is omitted
- **THEN** the default model is `gemini-2.5-pro`
