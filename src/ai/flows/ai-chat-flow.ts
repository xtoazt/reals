
'use server';
/**
 * @fileOverview A simple AI chat flow.
 *
 * - aiChat - A function that handles AI chat responses.
 * - AiChatInput - The input type for the aiChat function.
 * - AiChatOutput - The return type for the aiChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiChatInputSchema = z.object({
  message: z.string().describe("The user's message to the AI chatbot."),
  // Optional: Add history here if we want to make it conversational
  // history: z.array(z.object({role: z.enum(['user', 'model']), content: z.string()})).optional()
});
export type AiChatInput = z.infer<typeof AiChatInputSchema>;

const AiChatOutputSchema = z.object({
  response: z.string().describe("The AI chatbot's response."),
});
export type AiChatOutput = z.infer<typeof AiChatOutputSchema>;

export async function aiChat(input: AiChatInput): Promise<AiChatOutput> {
  return aiChatFlow(input);
}

const chatPrompt = ai.definePrompt({
  name: 'aiChatPrompt',
  input: {schema: AiChatInputSchema},
  output: {schema: AiChatOutputSchema},
  prompt: `You are a friendly and helpful AI assistant called 'RealTalk AI'.
Your responses should be concise and conversational.
User's message: {{{message}}}
`,
});

const aiChatFlow = ai.defineFlow(
  {
    name: 'aiChatFlow',
    inputSchema: AiChatInputSchema,
    outputSchema: AiChatOutputSchema,
  },
  async (input: AiChatInput) => {
    const {output} = await chatPrompt(input);
    if (!output) {
        return { response: "I'm sorry, I couldn't generate a response at this moment. Please try again." };
    }
    return output;
  }
);
