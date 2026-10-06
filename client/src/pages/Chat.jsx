import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar/Sidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import { useSocket } from '../hooks/useSocket';
import { useConversationStore } from '../store/conversationStore';

const Chat = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Initialize socket lifecycle & real-time listeners
  useSocket();

  const fetchConversations = useConversationStore((s) => s.fetchConversations);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="app-container">
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      <ChatWindow
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
      />
    </div>
  );
};

export default Chat;
