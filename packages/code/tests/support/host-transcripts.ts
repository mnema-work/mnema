/**
 * Transcript lines of each host, built from the host's SOURCE and not from a captured file: the
 * field names below are the ones the source writes, at the commit named in each section. A field
 * the source does not show is not here.
 */

/** One transcript as JSONL text. */
export function jsonl(lines: readonly unknown[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

/**
 * GEMINI CLI, google-gemini/gemini-cli at 573846625af9e93b3b968e0e0b86bb093a4c9b16.
 *  - packages/core/src/services/chatRecordingTypes.ts: MessageRecord {id, timestamp, content,
 *    displayContent?, type: 'user' | 'info' | 'error' | 'warning' | 'gemini', toolCalls? on
 *    'gemini'}, ToolCallRecord {id, name, args, result?, status, ...}, MetadataUpdateRecord
 *    {$set}, RewindRecord {$rewindTo}.
 *  - packages/core/src/services/chatRecordingService.ts: pushMessage appends the whole message
 *    again each time it changes; the loader keeps the last record of an id and a $rewindTo drops
 *    that id and every one after it; recordSyntheticMessage('user', parts) writes the turn that
 *    hands a tool's response back.
 *  - packages/core/src/core/geminiChat.ts (recordCompletedToolCalls): result is
 *    call.response.responseParts.
 *  - packages/core/src/utils/generateContentResponseUtilities.ts (createFunctionResponsePart):
 *    a string output is stored as {functionResponse: {id, name, response: {output}}}.
 *  - packages/core/src/tools/ask-user.ts (execute): llmContent is
 *    JSON.stringify({answers: {"<question index>": "<answer>"}}); a dismissal is the text
 *    'User dismissed ask_user dialog without answering.'. The tool name is 'ask_user'
 *    (tools/definitions/base-declarations.ts).
 */
export const GEMINI = {
  header: { sessionId: 'abcd1234-0000', projectHash: 'p', startTime: '2026-11-20T10:00:00.000Z' },
  typed: (id: string, text: string) => ({
    id,
    timestamp: '2026-11-20T10:00:01.000Z',
    type: 'user',
    content: [{ text }],
  }),
  /** A `user` record the host writes to hand a tool's response back to the model. */
  toolTurn: (id: string) => ({
    id,
    timestamp: '2026-11-20T10:00:03.000Z',
    type: 'user',
    content: [{ functionResponse: { id: 'call-1', name: 'ask_user', response: { output: 'x' } } }],
  }),
  info: (id: string, text: string) => ({
    id,
    timestamp: '2026-11-20T10:00:04.000Z',
    type: 'info',
    content: text,
  }),
  asked: (id: string, output: string, questions: readonly string[]) => ({
    id,
    timestamp: '2026-11-20T10:00:02.000Z',
    type: 'gemini',
    content: '',
    toolCalls: [
      {
        id: 'call-1',
        name: 'ask_user',
        args: { questions: questions.map((question) => ({ question, header: 'Q', type: 'choice' })) },
        result: [{ functionResponse: { id: 'call-1', name: 'ask_user', response: { output } } }],
        status: 'success',
        timestamp: '2026-11-20T10:00:02.500Z',
      },
    ],
  }),
};

/**
 * QWEN CODE, QwenLM/qwen-code at b475278c4a300acebe6cfc990a9e1b1d18819bfc,
 * packages/core/src/services/chatRecordingService.ts: ChatRecord {uuid, parentUuid, sessionId,
 * timestamp, type: 'user' | 'assistant' | 'tool_result' | 'system', subtype?, provenance?,
 * message?: Content {role, parts}, systemPayload?}; UserPromptRecordPayload {displayText,
 * hookContext}; recordUserMessage writes type 'user' with no subtype; recordMidTurnUserMessage,
 * recordCronPrompt, recordGoalRuntimeMessage write type 'user' WITH a subtype; the chat
 * compression checkpoint is a 'system' record of subtype 'chat_compression'.
 */
export const QWEN = {
  record: (fields: Record<string, unknown>) => ({
    uuid: 'u',
    parentUuid: null,
    sessionId: 's-1',
    timestamp: '2026-11-20T10:00:00.000Z',
    cwd: '/work',
    version: '0.0.0',
    ...fields,
  }),
  content: (text: string) => ({ role: 'user', parts: [{ text }] }),
};

/**
 * VS CODE AGENT MODE (Copilot Chat extension), microsoft/vscode at
 * 794308978b6d99a6268d7675f216867a78501e3f, extensions/copilot/src:
 *  - platform/chat/common/sessionTranscriptService.ts: TranscriptEntry {type, data, id,
 *    timestamp, parentId}; 'session.start', 'user.message' {content, attachments?},
 *    'assistant.turn_start', 'assistant.message' {messageId, content, toolRequests},
 *    'tool.execution_start', 'tool.execution_complete' {toolCallId, success, result?: {content}},
 *    'assistant.turn_end'.
 *  - extension/intents/node/toolCallingLoop.ts: logUserMessage(sessionId, turn.request.message);
 *    hook context is kept apart (additionalHookContext).
 *  - extension/chat/vscode-node/sessionTranscriptService.ts: the file is
 *    <extension storageUri>/transcripts/<sessionId>.jsonl; the storage folder is named by the
 *    extension's publisher and name ('GitHub', 'copilot-chat' in extensions/copilot/package.json).
 */
export const VSCODE = {
  entry: (type: string, data: unknown) => ({
    type,
    data,
    id: 'e',
    timestamp: '2026-11-20T10:00:00.000Z',
    parentId: null,
  }),
};
