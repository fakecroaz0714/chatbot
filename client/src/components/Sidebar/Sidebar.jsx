import React, { useState } from 'react';
import { MessageSquarePlus, Search } from 'lucide-react';
import ConversationList from './ConversationList';
import UserProfileBar from './UserProfileBar';
import UserSearchModal from './UserSearchModal';
import { useConversationStore } from '../../store/conversationStore';

const Sidebar = ({ isMobileOpen, onCloseMobile }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const conversations = useConversationStore((s) => s.conversations);
  const isLoading = useConversationStore((s) => s.isLoading);
  const error = useConversationStore((s) => s.error);
  const fetchConversations = useConversationStore((s) => s.fetchConversations);
  const activeConversation = useConversationStore((s) => s.activeConversation);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      <aside className={`sidebar ${!isMobileOpen ? 'hidden-mobile' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-logo">
            <img
              src="/halalchat-logo.svg"
              alt="HalalChat"
              style={{ height: '34px', objectFit: 'contain', display: 'block' }}
            />
          </div>

          <div className="sidebar-actions">
            <button
              onClick={() => setIsModalOpen(true)}
              className="icon-btn"
              title="Start New Chat"
            >
              <MessageSquarePlus size={20} />
            </button>
          </div>
        </div>

        <div className="sidebar-search-box">
          <div className="search-input-wrapper">
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ConversationList
          conversations={conversations}
          activeConversation={activeConversation}
          onSelectConversation={handleSelectConversation}
          searchQuery={searchQuery}
          onOpenNewChat={() => setIsModalOpen(true)}
          isLoading={isLoading}
          error={error}
          onRetry={fetchConversations}
        />

        <UserProfileBar />
      </aside>

      <UserSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

export default Sidebar;
