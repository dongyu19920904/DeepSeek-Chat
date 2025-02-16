import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { FiMessageSquare, FiSettings, FiUser, FiSend, FiZap, FiAlertCircle } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
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
            role: msg.role === 'error' ? 'assistant' : msg.role,
            content: msg.content,
          })),
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('无法解析服务器响应');
      }

      if (!response.ok) {
        throw new Error(data.error?.message || data.message || '请求失败');
      }

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('服务器返回了无效的响应格式');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.choices[0].message.content,
      };

      setMessages(prev => [...prev, assistantMessage]);
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
                    : 'bg-gray-700'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {message.role === 'user' ? (
                    <FiUser />
                  ) : message.role === 'error' ? (
                    <FiAlertCircle />
                  ) : (
                    <img src="/deepseek-logo.png" className="w-6 h-6" alt="DeepSeek" />
                  )}
                  <span className="font-medium">
                    {message.role === 'user' ? '你' : message.role === 'error' ? '错误' : 'DeepSeek'}
                  </span>
                </div>
                <ReactMarkdown className="prose prose-invert">
                  {message.content}
                </ReactMarkdown>
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