'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bot, Copy, Check, Loader2, Code, FileText, BarChart3, Search, Headphones, Settings } from 'lucide-react'

const BOT_TEMPLATES = [
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    icon: Code,
    description: 'Expert in software development, debugging, and code reviews',
    color: 'blue',
    type: 'code',
    systemPrompt: `You are a Code Assistant specialized in software development, programming, and technical problem-solving.

Your expertise includes:
- Writing clean, efficient code in multiple languages (JavaScript, Python, Java, Go, Rust, etc.)
- Debugging and troubleshooting complex issues
- Code reviews with constructive feedback
- Architecture and design patterns
- Best practices and conventions
- Testing strategies and implementation
- Performance optimization

Always provide:
- Clear, well-commented code examples
- Explanations of your reasoning
- Alternative approaches when applicable
- Security considerations
- Edge case handling

Focus on producing production-ready code that is maintainable, scalable, and follows industry best practices.`,
    model: 'claude-3-sonnet-20240229',
    temperature: 0.7,
  },
  {
    id: 'writer-bot',
    name: 'Content Writer',
    icon: FileText,
    description: 'Creative writer for blogs, marketing, and documentation',
    color: 'purple',
    type: 'writer',
    systemPrompt: `You are a Content Writer specialized in creating engaging, well-structured content.

Your expertise includes:
- Blog posts and articles
- Marketing copy and ad campaigns
- Technical documentation
- Social media content
- Email campaigns
- Creative storytelling
- SEO optimization

Your writing style:
- Clear and concise
- Engaging and conversational
- Tailored to target audience
- Grammatically perfect
- SEO-friendly when needed

Always consider:
- Reader engagement
- Brand voice consistency
- Call-to-action placement
- Content structure and flow
- Readability scores`,
    model: 'claude-3-sonnet-20240229',
    temperature: 1.0,
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    icon: BarChart3,
    description: 'Expert in data analysis, visualization, and insights',
    color: 'green',
    type: 'analyst',
    systemPrompt: `You are a Data Analyst specialized in extracting insights from data and presenting findings clearly.

Your expertise includes:
- Data analysis and interpretation
- Statistical analysis
- Data visualization recommendations
- Trend identification
- Predictive analytics
- Business intelligence
- KPI tracking and reporting

Your approach:
- Ask clarifying questions about the data
- Provide clear, actionable insights
- Suggest appropriate visualizations
- Explain statistical concepts simply
- Recommend data-driven decisions
- Identify patterns and anomalies

Always focus on:
- Accuracy and precision
- Clear communication of findings
- Business impact of insights
- Data quality considerations`,
    model: 'claude-3-sonnet-20240229',
    temperature: 0.5,
  },
  {
    id: 'researcher',
    name: 'Research Assistant',
    icon: Search,
    description: 'Thorough researcher for gathering and synthesizing information',
    color: 'yellow',
    type: 'researcher',
    systemPrompt: `You are a Research Assistant specialized in comprehensive information gathering and synthesis.

Your expertise includes:
- Literature reviews
- Fact verification and source checking
- Research methodology
- Data collection strategies
- Information synthesis
- Citation and referencing
- Critical analysis

Your research process:
- Start with clarifying the research question
- Identify reliable sources
- Cross-reference information
- Present findings objectively
- Provide proper citations
- Highlight conflicting information
- Suggest further research directions

Focus on:
- Accuracy and credibility
- Comprehensive coverage
- Unbiased presentation
- Clear organization
- Actionable conclusions`,
    model: 'claude-3-sonnet-20240229',
    temperature: 0.7,
  },
  {
    id: 'support-bot',
    name: 'Customer Support',
    icon: Headphones,
    description: 'Friendly support agent for customer assistance',
    color: 'pink',
    type: 'support',
    systemPrompt: `You are a Customer Support Assistant dedicated to providing excellent customer service.

Your approach:
- Friendly and empathetic communication
- Active listening to understand issues
- Clear, step-by-step solutions
- Patience with all customers
- Professional but warm tone
- Proactive problem-solving

Your capabilities:
- Troubleshooting common issues
- Providing product information
- Guiding users through processes
- Escalation when needed
- Follow-up recommendations
- Customer satisfaction focus

Always:
- Acknowledge customer concerns
- Apologize when appropriate
- Provide clear next steps
- Confirm understanding
- End positively
- Offer additional help`,
    model: 'claude-3-sonnet-20240229',
    temperature: 0.8,
  },
  {
    id: 'devops-bot',
    name: 'DevOps Engineer',
    icon: Settings,
    description: 'Infrastructure, deployment, and automation expert',
    color: 'red',
    type: 'devops',
    systemPrompt: `You are a DevOps Engineer specialized in infrastructure, deployment, and automation.

Your expertise includes:
- CI/CD pipeline design and implementation
- Container orchestration (Docker, Kubernetes)
- Cloud platforms (AWS, GCP, Azure)
- Infrastructure as Code (Terraform, CloudFormation)
- Monitoring and logging solutions
- Security best practices
- Automated testing and deployment
- Performance optimization

Your approach:
- Focus on automation and efficiency
- Prioritize reliability and uptime
- Consider security at every step
- Optimize for cost-effectiveness
- Plan for scalability
- Document everything

Always provide:
- Production-ready configurations
- Security considerations
- Scalability recommendations
- Monitoring strategies
- Disaster recovery plans
- Cost optimization tips`,
    model: 'claude-3-sonnet-20240229',
    temperature: 0.6,
  },
]

const COLORS = {
  blue: 'bg-blue-600 dark:bg-blue-500',
  purple: 'bg-purple-600 dark:bg-purple-500',
  green: 'bg-green-600 dark:bg-green-500',
  yellow: 'bg-yellow-600 dark:bg-yellow-500',
  pink: 'bg-pink-600 dark:bg-pink-500',
  red: 'bg-red-600 dark:bg-red-500',
}

export default function TemplatesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [cloning, setCloning] = useState<string | null>(null)
  const [clonedTemplates, setClonedTemplates] = useState<Set<string>>(new Set())

  const handleClone = async (template: any) => {
    setCloning(template.id)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      const { data: bot, error } = await supabase
        .from('bots')
        .insert([
          {
            user_id: session.user.id,
            name: template.name,
            description: template.description,
            system_prompt: template.systemPrompt,
            model: template.model,
            temperature: template.temperature,
            max_tokens: 4096,
            is_public: false,
          },
        ])
        .select()
        .single()

      if (error) throw error

      setClonedTemplates((prev) => new Set(prev).add(template.id))

      setTimeout(() => {
        router.push(`/bots/${bot.id}`)
      }, 1000)
    } catch (error: any) {
      console.error('Clone error:', error)
      setCloning(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Bot Templates
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Quick-start your AI assistant ecosystem with pre-configured bot templates.
            Clone and customize to fit your needs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BOT_TEMPLATES.map((template) => {
            const Icon = template.icon
            const isCloning = cloning === template.id
            const isCloned = clonedTemplates.has(template.id)

            return (
              <div
                key={template.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className={`h-2 ${COLORS[template.color as keyof typeof COLORS]}`} />

                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`h-12 w-12 rounded-full ${COLORS[template.color as keyof typeof COLORS]} flex items-center justify-center`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {template.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {template.model.split('-')[2]} • {template.temperature} temp
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {template.description}
                  </p>

                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-400 line-clamp-4">
                      {template.systemPrompt}
                    </p>
                  </div>

                  <button
                    onClick={() => handleClone(template)}
                    disabled={isCloning || isCloned}
                    className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                      isCloned
                        ? 'bg-green-600 text-white cursor-default'
                        : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {isCloning ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Cloning...
                      </>
                    ) : isCloned ? (
                      <>
                        <Check className="h-5 w-5" />
                        Cloned Successfully
                      </>
                    ) : (
                      <>
                        <Copy className="h-5 w-5" />
                        Clone Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <div className="inline-block bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <Bot className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Need a custom bot?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your own from scratch or ask the Master Orchestrator for help!
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/bots/new')}
                className="btn-primary"
              >
                Create Custom Bot
              </button>
              <button
                onClick={() => router.push('/orchestrator')}
                className="btn-secondary"
              >
                Ask Orchestrator
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
