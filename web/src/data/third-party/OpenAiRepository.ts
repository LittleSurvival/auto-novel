// Copyright 2023 OpenAI
import ky, { HTTPError, Options } from 'ky';

import { parseEventStream, safeJson } from '@/util';

export const createOpenAiRepository = (
  endpoint: string,
  key: string,
  timeout: number = 600_000,
) => {
  const client = ky.create({
    prefixUrl: endpoint,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    timeout: timeout,
    retry: 0,
  });

  const listModels = (options?: Options): Promise<ModelsPage> =>
    client.get('v1/models', options).json<ModelsPage>();

  const createChatCompletionsStream = (
    json: ChatCompletion.Params & { stream: true },
    options?: Options,
  ): Promise<Generator<ChatCompletionChunk>> =>
    client
      .post('v1/chat/completions', { json, ...options })
      .text()
      .then(parseEventStream<ChatCompletionChunk>);

  const createChatCompletions = (
    json: ChatCompletion.Params & { stream?: false },
    options?: Options,
  ): Promise<ChatCompletion> =>
    client
      .post('v1/chat/completions', { json, ...options })
      .json<ChatCompletion>();

  return {
    listModels,
    createChatCompletionsStream,
    createChatCompletions,
  };
};

interface ModelsPage {
  object: 'list';
  data: Model[];
}

interface Model {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  meta: any;
}

interface ChatCompletionChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string | null;
    };
    finish_reason:
      | 'stop'
      | 'length'
      | 'function_call'
      | 'content_filter'
      | null;
    index: number;
  }>;
}

interface ChatCompletion {
  id: string;
  model: string;
  choices: Array<{
    /**
     * The reason the model stopped generating tokens. This will be `stop` if the model
     * hit a natural stop point or a provided stop sequence, `length` if the maximum
     * number of tokens specified in the request was reached, `content_filter` if
     * content was omitted due to a flag from our content filters, or `function_call`
     * if the model called a function.
     */
    finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter';
    index: number;
    message: {
      content: string | null;
      role: 'system' | 'user' | 'assistant' | 'function';
    };
  }>;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
  // llamacpp特有
  completion_probabilities?: Array<{
    content: string;
    probs: Array<{
      prob: number;
      tok_str: string;
    }>;
  }>;
}

namespace ChatCompletion {
  export interface Params {
    messages: Array<{
      content: string;
      role: 'system' | 'user' | 'assistant';
    }>;

    /**
     * ID of the model to use. See the
     * [model endpoint compatibility](https://platform.openai.com/docs/models/model-endpoint-compatibility)
     * table for details on which models work with the Chat API.
     */
    model:
      | (string & {})
      | 'gpt-4'
      | 'gpt-4-0314'
      | 'gpt-4-0613'
      | 'gpt-4-32k'
      | 'gpt-4-32k-0314'
      | 'gpt-4-32k-0613'
      | 'gpt-3.5-turbo'
      | 'gpt-3.5-turbo-16k'
      | 'gpt-3.5-turbo-0301'
      | 'gpt-3.5-turbo-0613'
      | 'gpt-3.5-turbo-16k-0613';

    /**
     * Number between -2.0 and 2.0. Positive values penalize new tokens based on their
     * existing frequency in the text so far, decreasing the model's likelihood to
     * repeat the same line verbatim.
     *
     * [See more information about frequency and presence penalties.](https://platform.openai.com/docs/guides/gpt/parameter-details)
     */
    frequency_penalty?: number | null;

    /**
     * Controls how the model responds to function calls. `none` means the model does
     * not call a function, and responds to the end-user. `auto` means the model can
     * pick between an end-user or calling a function. Specifying a particular function
     * via `{"name": "my_function"}` forces the model to call that function. `none` is
     * the default when no functions are present. `auto` is the default if functions
     * are present.
     */
    function_call?:
      | 'none'
      | 'auto'
      | {
          name: string; // The name of the function to call.
        };

    /**
     * Modify the likelihood of specified tokens appearing in the completion.
     *
     * Accepts a json object that maps tokens (specified by their token ID in the
     * tokenizer) to an associated bias value from -100 to 100. Mathematically, the
     * bias is added to the logits generated by the model prior to sampling. The exact
     * effect will vary per model, but values between -1 and 1 should decrease or
     * increase likelihood of selection; values like -100 or 100 should result in a ban
     * or exclusive selection of the relevant token.
     */
    logit_bias?: Record<string, number> | null;

    /**
     * Whether to return log probabilities of the output tokens or not. If true,
     * returns the log probabilities of each output token returned in the `content` of
     * `message`.
     */
    logprobs?: boolean | null;

    /**
     * An integer between 0 and 20 specifying the number of most likely tokens to
     * return at each token position, each with an associated log probability.
     * `logprobs` must be set to `true` if this parameter is used.
     */
    top_logprobs?: number | null;

    /**
     * The maximum number of [tokens](/tokenizer) to generate in the chat completion.
     *
     * The total length of input tokens and generated tokens is limited by the model's
     * context length.
     * [Example Python code](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb)
     * for counting tokens.
     */
    max_tokens?: number | null;

    /**
     * How many chat completion choices to generate for each input message.
     */
    n?: number | null;

    /**
     * Number between -2.0 and 2.0. Positive values penalize new tokens based on
     * whether they appear in the text so far, increasing the model's likelihood to
     * talk about new topics.
     *
     * [See more information about frequency and presence penalties.](https://platform.openai.com/docs/guides/gpt/parameter-details)
     */
    presence_penalty?: number | null;

    /**
     * This feature is in Beta. If specified, our system will make a best effort to
     * sample deterministically, such that repeated requests with the same `seed` and
     * parameters should return the same result. Determinism is not guaranteed, and you
     * should refer to the `system_fingerprint` response parameter to monitor changes
     * in the backend.
     */
    seed?: number | null;

    /**
     * Up to 4 sequences where the API will stop generating further tokens.
     */
    stop?: string | null | Array<string>;

    /**
     * If set, partial message deltas will be sent, like in ChatGPT. Tokens will be
     * sent as data-only
     * [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format)
     * as they become available, with the stream terminated by a `data: [DONE]`
     * message.
     * [Example Python code](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_stream_completions.ipynb).
     */
    stream?: boolean | null;

    /**
     * What sampling temperature to use, between 0 and 2. Higher values like 0.8 will
     * make the output more random, while lower values like 0.2 will make it more
     * focused and deterministic.
     *
     * We generally recommend altering this or `top_p` but not both.
     */
    temperature?: number | null;

    /**
     * An alternative to sampling with temperature, called nucleus sampling, where the
     * model considers the results of the tokens with top_p probability mass. So 0.1
     * means only the tokens comprising the top 10% probability mass are considered.
     *
     * We generally recommend altering this or `temperature` but not both.
     */
    top_p?: number | null;

    /**
     * A unique identifier representing your end-user, which can help OpenAI to monitor
     * and detect abuse.
     * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids).
     */
    user?: string;
  }
}

export class OpenAiError extends Error {
  readonly status: number | undefined;
  readonly code: string | null | undefined;

  constructor(
    status: number | undefined,
    code: string | undefined,
    message: string | undefined,
  ) {
    super(`${status} ${code ?? 'unknown_code'} ${message}`);
    this.status = status;
    this.code = code;
  }

  static async handle(e: any): Promise<never> {
    if (e instanceof HTTPError) {
      const errText = await e.response.text().catch((err) => {
        if (err instanceof Error) return err.message;
        return `${err}`;
      });
      const errJson = safeJson<any>(errText);
      throw new OpenAiError(
        e.response.status,
        errJson?.['error']?.['code'],
        errText,
      );
    } else {
      throw e;
    }
  }
}
