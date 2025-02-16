import { useState, useRef, useEffect } from 'react';
import { FiMessageSquare, FiSettings, FiUser, FiSend, FiZap, FiAlertCircle } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant' | 'error' | 'thinking';
  content: string;
  thinking?: string[];
  isStreaming?: boolean;
  showThinking?: boolean;
}

interface ModelConfig {
  name: string;
  id: string;
}

interface APIErrorResponse {
  error?: {
    message?: string;
    type?: string;
  };
  message?: string;
}

const models: ModelConfig[] = [
  { name: '普通模式', id: 'Pro/deepseek-ai/DeepSeek-V3' },
  { name: '深度思考', id: 'Pro/deepseek-ai/DeepSeek-R1' }
];

const DEFAULT_API_KEY = 'sk-nsclkfifdmonwipbmsizemryjoywiefungoxsfnpidnmpprq';
const DEFAULT_API_URL = 'https://api.siliconflow.cn/v1';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showSettings, setShowSettings] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleError = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    
    try {
      const errorObj = error as APIErrorResponse;
      return errorObj.error?.message || errorObj.message || '发生未知错误';
    } catch {
      return '发生未知错误';
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    if (selectedModel.id === 'Pro/deepseek-ai/DeepSeek-R1') {
      const thinkingMessage: Message = {
        role: 'thinking',
        content: '',
        thinking: [],
        isStreaming: true,
        showThinking: true
      };
      setMessages(prev => [...prev, thinkingMessage]);
    }

    try {
      const response = await fetch(apiUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel.id,
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role === 'error' || msg.role === 'thinking' ? 'assistant' : msg.role,
            content: msg.content,
          })),
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      let assistantMessage: Message = {
        role: 'assistant',
        content: '',
        isStreaming: true,
      };
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(5));
            if (data.choices?.[0]?.delta?.content) {
              const content = data.choices[0].delta.content;
              assistantMessage.content += content;
              
              if (selectedModel.id === 'Pro/deepseek-ai/DeepSeek-R1' && content.includes('思考过程：')) {
                const thinkingMatch = content.match(/思考过程：([\s\S]*?)结论：/);
                if (thinkingMatch) {
                  const thoughts = thinkingMatch[1].split('\n').filter(t => t.trim());
                  assistantMessage.thinking = thoughts;
                }
              }
              
              setMessages(prev => prev.map((msg, i) => 
                i === prev.length - 1 ? { ...assistantMessage } : msg
              ));
            }
          }
        }
      }

      assistantMessage.isStreaming = false;
      setMessages(prev => prev.map((msg, i) => 
        i === prev.length - 1 ? { ...assistantMessage } : msg
      ));

    } catch (error) {
      const errorMessage: Message = {
        role: 'error',
        content: handleError(error),
      };
      setMessages(prev => [...prev, errorMessage]);
      console.error('API Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleThinking = (index: number) => {
    setMessages(prev => prev.map((msg, i) => 
      i === index ? { ...msg, showThinking: !msg.showThinking } : msg
    ));
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 p-4 flex flex-col">
        <button
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg mb-4"
          onClick={() => setMessages([])}
        >
          <FiMessageSquare />
          开启新对话
        </button>
        
        <div className="flex-grow overflow-y-auto">
          {/* Chat history would go here */}
        </div>

        <div className="mt-auto">
          <button
            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700 rounded-lg"
            onClick={() => setShowSettings(!showSettings)}
          >
            <FiSettings />
            设置
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={clsx(
                'mb-4 flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={clsx(
                  'max-w-3xl rounded-lg p-4',
                  message.role === 'user'
                    ? 'bg-blue-600'
                    : message.role === 'error'
                    ? 'bg-red-600'
                    : message.role === 'thinking'
                    ? 'bg-gray-600'
                    : 'bg-gray-700'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {message.role === 'user' ? (
                    <FiUser />
                  ) : message.role === 'error' ? (
                    <FiAlertCircle />
                  ) : message.role === 'thinking' ? (
                    <FiZap className="animate-pulse" />
                  ) : (
                    <img src="/deepseek-logo.png" className="w-6 h-6" alt="DeepSeek" />
                  )}
                  <span className="font-medium">
                    {message.role === 'user' ? '你' : 
                     message.role === 'error' ? '错误' : 
                     message.role === 'thinking' ? '思考中...' : 
                     'DeepSeek'}
                  </span>
                  {message.thinking && message.thinking.length > 0 && (
                    <button
                      onClick={() => toggleThinking(index)}
                      className="ml-2 text-sm text-gray-300 hover:text-white"
                    >
                      {message.showThinking ? '收起思考过程' : '展开思考过程'}
                    </button>
                  )}
                </div>
                
                {message.thinking && message.showThinking && (
                  <div className="mb-4 p-2 bg-gray-800 rounded">
                    <div className="text-sm text-gray-300 mb-2">思考过程：</div>
                    {message.thinking.map((thought, i) => (
                      <div key={i} className="ml-4 text-sm text-gray-300">
                        {i + 1}. {thought}
                      </div>
                    ))}
                  </div>
                )}
                
                <ReactMarkdown className="prose prose-invert">
                  {message.content}
                </ReactMarkdown>
                
                {message.isStreaming && (
                  <div className="mt-2">
                    <div className="animate-pulse inline-block w-2 h-4 bg-gray-400 rounded"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            {models.map((model) => (
              <button
                key={model.id}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg',
                  selectedModel.id === model.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600'
                )}
                onClick={() => setSelectedModel(model)}
              >
                {model.name === '深度思考' ? <FiZap /> : <FiMessageSquare />}
                {model.name}
              </button>
            ))}
          </div>
          
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入消息..."
              className="flex-1 bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <FiSend />
              发送
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">设置</h2>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-gray-700 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block mb-2">API URL</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full bg-gray-700 rounded px-3 py-2"
                />
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;