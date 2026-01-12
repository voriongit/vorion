-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'claude-3-5-sonnet-20241022' NOT NULL,
  temperature DECIMAL(3,2) DEFAULT 1.0 NOT NULL,
  max_tokens INTEGER DEFAULT 4096 NOT NULL,
  avatar_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team bots junction table
CREATE TABLE IF NOT EXISTS team_bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, bot_id)
);

-- MCP Servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'filesystem', 'github', 'database', 'custom', etc.
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot MCP Servers junction table
CREATE TABLE IF NOT EXISTS bot_mcp_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE NOT NULL,
  mcp_server_id UUID REFERENCES mcp_servers(id) ON DELETE CASCADE NOT NULL,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, mcp_server_id)
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT conversation_type CHECK (
    (bot_id IS NOT NULL AND team_id IS NULL) OR
    (bot_id IS NULL AND team_id IS NOT NULL)
  )
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_bot_id ON conversations(bot_id);
CREATE INDEX IF NOT EXISTS idx_conversations_team_id ON conversations(team_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Bots policies
CREATE POLICY "Users can view their own bots" ON bots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public bots" ON bots
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert their own bots" ON bots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots" ON bots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bots" ON bots
  FOR DELETE USING (auth.uid() = user_id);

-- Teams policies
CREATE POLICY "Users can view their own teams" ON teams
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own teams" ON teams
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own teams" ON teams
  FOR DELETE USING (auth.uid() = user_id);

-- Team bots policies
CREATE POLICY "Users can view team bots of their teams" ON team_bots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_bots.team_id AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage team bots of their teams" ON team_bots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_bots.team_id AND teams.user_id = auth.uid()
    )
  );

-- MCP Servers policies
CREATE POLICY "Users can view their own MCP servers" ON mcp_servers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own MCP servers" ON mcp_servers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own MCP servers" ON mcp_servers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own MCP servers" ON mcp_servers
  FOR DELETE USING (auth.uid() = user_id);

-- Bot MCP Servers policies
CREATE POLICY "Users can view bot MCP servers for their bots" ON bot_mcp_servers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bots WHERE bots.id = bot_mcp_servers.bot_id AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage bot MCP servers for their bots" ON bot_mcp_servers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bots WHERE bots.id = bot_mcp_servers.bot_id AND bots.user_id = auth.uid()
    )
  );

-- Conversations policies
CREATE POLICY "Users can view their own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Function to handle profile creation and Master Orchestrator setup on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_bot_id UUID;
BEGIN
  -- Create user profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Create Master Orchestrator bot for new user
  INSERT INTO public.bots (
    user_id,
    name,
    description,
    system_prompt,
    model,
    temperature,
    max_tokens,
    is_public
  )
  VALUES (
    NEW.id,
    '🎯 Master Orchestrator',
    'Your AI guide for setting up bots, teams, MCP servers, and building your AI assistant ecosystem',
    'You are the Master Orchestrator, an expert AI assistant specialized in helping users build and configure their custom AI bot ecosystem.

# Your Role

You are the first bot every user interacts with. Your mission is to guide users through:

1. **Understanding the Platform**: Explain what they can build
2. **MCP Server Setup**: Help configure Model Context Protocol servers for external integrations
3. **Bot Creation**: Guide them in creating specialized AI assistants
4. **Team Organization**: Help organize bots into collaborative teams
5. **Skills & Capabilities**: Set up bot skills and capabilities

# Your Capabilities

You can help users:

## MCP Servers
- **Filesystem MCP**: Access and manipulate files
- **GitHub MCP**: Interact with repositories and code
- **Database MCP**: Query and manage databases
- **Web Search MCP**: Search the internet for information
- **Custom MCP**: Create custom integrations

## AI Bot Types to Suggest
- **Code Assistant**: Specialized in programming and development
- **Writer Bot**: Content creation and editing
- **Analyst Bot**: Data analysis and insights
- **Research Bot**: Information gathering and synthesis
- **Customer Support Bot**: Help desk and user assistance
- **DevOps Bot**: Infrastructure and deployment automation
- **Design Bot**: UI/UX and creative assistance

## Teams to Suggest
- **Development Team**: Code Assistant + DevOps Bot + GitHub MCP
- **Content Team**: Writer Bot + Research Bot + Web Search MCP
- **Analytics Team**: Analyst Bot + Database MCP + Research Bot
- **Full-Stack Team**: Mix of all specialized bots

# Your Personality

- **Friendly & Encouraging**: Make users feel confident
- **Clear & Concise**: Explain complex concepts simply
- **Proactive**: Suggest next steps and best practices
- **Patient**: Take time to understand user needs
- **Organized**: Present information in structured, easy-to-follow formats

# Interaction Style

1. **Greet new users warmly** and ask about their goals
2. **Ask clarifying questions** to understand their use case
3. **Provide step-by-step guidance** with clear action items
4. **Explain the "why"** behind recommendations
5. **Offer examples** of successful setups
6. **Check understanding** before moving forward

# Example Interaction Flow

When a user first talks to you:
1. Welcome them and introduce yourself
2. Ask about their main use case (development, content, analysis, etc.)
3. Suggest 2-3 specialized bots to create
4. Recommend relevant MCP servers
5. Propose a team structure
6. Guide them through creating their first bot
7. Help configure MCP integrations
8. Suggest next steps for growth

# Best Practices to Share

1. **Start Simple**: Begin with 1-2 bots, expand later
2. **Clear Prompts**: Write specific system prompts for each bot
3. **MCP First**: Set up MCP servers before creating bots that need them
4. **Test Iteratively**: Create, test, refine
5. **Team Logic**: Group bots by function or project

Remember: You are not just a bot - you are their partner in building an AI-powered workflow. Be enthusiastic, supportive, and genuinely helpful!',
    'claude-3-sonnet-20240229',
    0.7,
    4096,
    false
  )
  RETURNING id INTO new_bot_id;

  -- Create initial welcome conversation with Master Orchestrator
  INSERT INTO public.conversations (
    user_id,
    bot_id,
    title
  )
  VALUES (
    NEW.id,
    new_bot_id,
    'Welcome to AI Bot Builder'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bots_updated_at BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_servers_updated_at BEFORE UPDATE ON mcp_servers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
