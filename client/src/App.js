import React, { useEffect, useState, useRef } from 'react';
import socket from './socket';
import './App.css';
const ping = new Audio('/ping.mp3');

function App() {
  const [username, setUsername] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [typingStatus, setTypingStatus] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [room, setRoom] = useState('General');
  const [recipient, setRecipient] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [reactions, setReactions] = useState({});
  const [unread, setUnread] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [connected, setConnected] = useState(true);
  const [page, setPage] = useState(1);
  const messageRef = useRef(null);

  useEffect(() => {
    const user = prompt('Enter your username');
    if (user) {
      const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${user}`;
      setUsername(user);
      localStorage.setItem('avatar', avatar);
      socket.emit('newUser', user);
      socket.emit('joinRoom', room);
    }

    Notification.requestPermission();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('message', (data) => {
      ping.play();
      showBrowserNotification(`💬 New message in ${room}`, data.text || '[Image]');
      setMessages((prev) => [...prev, data]);
    });

    socket.on('privateMessage', (data) => {
      ping.play();
      showBrowserNotification(`📩 New message from ${data.from}`, data.text || '[Image]');
      setPrivateMessages((prev) => [...prev, data]);
      if (data.from !== recipient) {
        setUnread((prev) => ({ ...prev, [data.from]: (prev[data.from] || 0) + 1 }));
      }
      socket.emit('readMessage', { from: data.from });
    });

    socket.on('typing', (user) => setTypingStatus(`${user} is typing...`));
    socket.on('stopTyping', () => setTypingStatus(''));
    socket.on('updateUsers', (users) => setOnlineUsers(users));
    socket.on('messageRead', ({ by, time }) => alert(`✅ Your message was read by ${by} at ${time}`));
    socket.on('messageReaction', ({ id, emoji }) => {
      setReactions((prev) => ({ ...prev, [id]: [...(prev[id] || []), emoji] }));
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('message');
      socket.off('privateMessage');
      socket.off('typing');
      socket.off('stopTyping');
      socket.off('updateUsers');
      socket.off('messageRead');
      socket.off('messageReaction');
    };
  }, []);

  useEffect(() => {
    socket.emit('joinRoom', room);
    setMessages([]);
    setPage(1);
  }, [room]);

  const handleTyping = () => {
    socket.emit('typing', username);
    setTimeout(() => socket.emit('stopTyping'), 1000);
  };

  const sendMessage = () => {
    if (input.trim()) {
      const time = new Date().toLocaleTimeString();
      const id = Math.random().toString(36).substring(2, 9);
      const messageData = { id, user: username, text: input, time };
      if (isPrivate && recipient) {
        socket.emit('privateMessage', { to: recipient, ...messageData });
      } else {
        socket.emit('roomMessage', messageData);
        setMessages((prev) => [...prev, messageData]);
      }
      setInput('');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const time = new Date().toLocaleTimeString();
        const id = Math.random().toString(36).substring(2, 9);
        const payload = { id, user: username, image: reader.result, time };
        if (isPrivate && recipient) {
          socket.emit('privateMessage', { to: recipient, ...payload });
        } else {
          socket.emit('roomMessage', payload);
          setMessages((prev) => [...prev, payload]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const reactToMessage = (id, emoji) => {
    socket.emit('reactToMessage', { id, emoji, room });
  };

  const showBrowserNotification = (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  };

  const filteredMessages = (isPrivate ? privateMessages : messages).filter(
    (msg) =>
      msg.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.user?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const loadMoreMessages = () => {
    setPage((prev) => prev + 1);
    // TODO: Implement backend pagination API call if needed
  };

  const renderMessages = (list) =>
    list.map((msg, i) => {
      const name = msg.user || msg.from || 'Unknown';
      const isSystem = msg.user === 'System';
      const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`;
      return (
        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          {!isSystem && <img src={avatar} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%' }} />}
          <div>
            {isSystem ? (
              <p style={{ color: 'gray', fontStyle: 'italic' }}>{msg.text}</p>
            ) : (
              <>
                <p><strong>{name}</strong> ({msg.time}):</p>
                {msg.text && <p>{msg.text}</p>}
                {msg.image && <img src={msg.image} alt="shared" style={{ maxWidth: '200px' }} />}
                {msg.id && (
                  <div>
                    <button onClick={() => reactToMessage(msg.id, '👍')}>👍</button>
                    <button onClick={() => reactToMessage(msg.id, '❤️')}>❤️</button>
                    <span>{reactions[msg.id]?.join(' ')}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    });

  return (
    <div style={{ padding: 20, backgroundColor: darkMode ? '#1e1e1e' : '#fff', color: darkMode ? '#eee' : '#000', minHeight: '100vh' }}>
      <h2>💬 Real-Time Chat App</h2>
      {!connected && <p style={{ color: 'red' }}>Disconnected. Attempting to reconnect...</p>}

      <button onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="🔍 Search messages"
        style={{ margin: '10px 0', width: '100%' }}
      />

      <p>👥 Online: {onlineUsers.join(', ')}</p>

      <div style={{ marginBottom: 10 }}>
        <label>📺 Select Room: </label>
        <select value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="General">General</option>
          <option value="Coding">Coding</option>
          <option value="Gaming">Gaming</option>
        </select>
        <button onClick={() => setIsPrivate(!isPrivate)} style={{ marginLeft: 10 }}>
          {isPrivate ? '🔓 Public' : '🔒 Private'}
        </button>
      </div>

      {isPrivate && (
        <div style={{ marginBottom: 10 }}>
          <input
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              setUnread((prev) => ({ ...prev, [e.target.value]: 0 }));
            }}
            placeholder="Recipient Username"
          />
          {unread[recipient] > 0 && (
            <span style={{ color: 'red', marginLeft: 10 }}>🔴 {unread[recipient]} unread</span>
          )}
        </div>
      )}

      <input type="file" accept="image/*" onChange={handleFileUpload} style={{ marginBottom: 10 }} />

      <div
        ref={messageRef}
        style={{ height: '250px', overflowY: 'scroll', border: '1px solid #ccc', marginBottom: 10, padding: 10 }}
        onScroll={(e) => {
          if (e.target.scrollTop === 0) loadMoreMessages();
        }}
      >
        {renderMessages(filteredMessages)}
      </div>

      <p>{typingStatus}</p>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleTyping}
        placeholder="Type your message"
        style={{ width: '70%', marginRight: 10 }}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default App;