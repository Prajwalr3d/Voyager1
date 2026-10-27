import { apiRequest, getDemoModePreference } from './apiClient';
import { ChatMessage, Citation } from '../types';
import { DEMO_CHAT_MESSAGES } from '../demo/demoData';

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  if (getDemoModePreference()) {
    return Promise.resolve([...DEMO_CHAT_MESSAGES]);
  }
  return apiRequest<ChatMessage[]>('/api/v1/chat/history');
}

export async function sendChatMessage(
  message: string,
  options?: {
    documentId?: string;
    versionPolicy?: 'active_only' | 'historical_pinned' | 'all_versions';
    targetVersionId?: string;
    targetVersionTag?: string;
    conversationHistory?: ChatMessage[];
    strategy?: string;
    enableGraphExpansion?: boolean;
    expansionBudget?: number;
  }
): Promise<ChatMessage> {
  const versionPolicy = options?.versionPolicy || 'active_only';
  const targetTag = options?.targetVersionTag || (versionPolicy === 'historical_pinned' ? 'v1.0.0' : 'v2.0.0');
  const enableGraph = !!options?.enableGraphExpansion;
  const budget = options?.expansionBudget || 512;

  if (getDemoModePreference()) {
    // Generate grounded response from demo dataset
    const isResNetQuery = message.toLowerCase().includes('resnet') || message.toLowerCase().includes('residual');
    
    let answer = '';
    let citations: Citation[] = [];

    if (versionPolicy === 'historical_pinned' && targetTag.includes('v1')) {
      // Historical version v1 retrieval: strictly isolated evidence
      answer = `[Historical Archive Pinned — Version ${targetTag}]\n\nAccording to the earlier arXiv preprint version of "Attention Is All You Need" (${targetTag}):\n\n$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{d_k}\\right)V$$\n\nNotice that in this historical preprint draft, the dot products were scaled by $d_k$ rather than $\\sqrt{d_k}$. This was later corrected in the camera-ready version (v2.0.0) because dividing by large $d_k$ caused variance underflow, whereas $\\sqrt{d_k}$ preserves unit variance for normal inputs.`;

      citations = [
        {
          id: `cit-hist-${Date.now()}`,
          document_id: 'doc-vaswani-2017',
          document_name: 'Attention Is All You Need',
          document_version_id: options?.targetVersionId || 'ver-vaswani-v1',
          version_tag: targetTag,
          chunk_id: 'chk-vaswani-v1-005',
          page_number: 3,
          heading_path: ['3. Model Architecture', '3.2 Attention', '3.2.1 Scaled Dot-Product Attention'],
          snippet: 'We call our particular attention "Scaled Dot-Product Attention". Attention(Q, K, V) = softmax(Q K^T / d_k) V. We choose d_k as the scaling factor.',
          relevance_score: 0.95,
          content_type: 'formula',
        },
      ];
    } else if (versionPolicy === 'all_versions') {
      // Multi-version comparative provenance
      answer = `[Cross-Version Evidence Comparison — v1.0.0 vs v2.0.0]\n\nRetrieved evidence across active and historical versions shows a critical mathematical refinement:\n\n1. **Active Camera-Ready (v2.0.0):**\n   $$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n   Scaling by $\\frac{1}{\\sqrt{d_k}}$ prevents vanishing gradients by normalizing the dot product variance back to $1$.\n\n2. **Historical Preprint (v1.0.0):**\n   Divided by linear $d_k$, which over-damped the attention scores when $d_k = 64$.`;

      citations = [
        {
          id: `cit-v2-${Date.now()}`,
          document_id: 'doc-vaswani-2017',
          document_name: 'Attention Is All You Need',
          document_version_id: 'ver-vaswani-v2',
          version_tag: 'v2.0.0',
          chunk_id: 'chk-vaswani-005',
          page_number: 4,
          heading_path: ['3. Model Architecture', '3.2 Attention', '3.2.1 Scaled Dot-Product Attention'],
          snippet: 'We compute the dot products of the query with all keys, divide each by sqrt(d_k), and apply a softmax function.',
          relevance_score: 0.98,
          content_type: 'formula',
        },
        {
          id: `cit-v1-${Date.now()}`,
          document_id: 'doc-vaswani-2017',
          document_name: 'Attention Is All You Need',
          document_version_id: 'ver-vaswani-v1',
          version_tag: 'v1.0.0',
          chunk_id: 'chk-vaswani-v1-005',
          page_number: 3,
          heading_path: ['3. Model Architecture', '3.2 Attention', '3.2.1 Scaled Dot-Product Attention'],
          snippet: 'Attention(Q, K, V) = softmax(Q K^T / d_k) V',
          relevance_score: 0.92,
          content_type: 'formula',
        },
      ];
    } else {
      // Default: Active version only (guaranteed version isolation)
      answer = `According to the active camera-ready version (${targetTag}) of "Attention Is All You Need", the attention calculation is formulated as:

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$

The dot product is scaled by $\\frac{1}{\\sqrt{d_k}}$ to mitigate extreme values that cause vanishing gradients in softmax saturation.`;

      citations = [
        {
          id: `cit-${Date.now()}`,
          document_id: 'doc-vaswani-2017',
          document_name: 'Attention Is All You Need',
          document_version_id: options?.targetVersionId || 'ver-vaswani-v2',
          version_tag: targetTag,
          chunk_id: 'chk-vaswani-005',
          page_number: 4,
          heading_path: ['3. Model Architecture', '3.2 Attention', '3.2.1 Scaled Dot-Product Attention'],
          snippet: 'We compute the dot products of the query with all keys, divide each by sqrt(d_k), and apply a softmax function to obtain the weights on the values.',
          relevance_score: 0.96,
          content_type: 'formula',
        },
      ];
    }

    if (isResNetQuery) {
      answer = `In "Deep Residual Learning for Image Recognition" (Active Version v1.2.0), the residual formulation addresses the degradation problem in deep networks:

$$\\mathbf{y} = \\mathcal{F}(\\mathbf{x}, \\{W_i\\}) + \\mathbf{x}$$

where $\\mathbf{x}$ and $\\mathbf{y}$ are the input and output vectors, and $\\mathcal{F}(\\mathbf{x}, \\{W_i\\})$ represents the residual mapping to be learned. The shortcut connection performs identity mapping, adding no extra parameters.`;

      citations = [
        {
          id: `cit-${Date.now()}`,
          document_id: 'doc-he-2015-resnet',
          document_name: 'Deep Residual Learning for Image Recognition',
          document_version_id: 'ver-resnet-v2',
          version_tag: 'v1.2.0',
          chunk_id: 'chk-resnet-004',
          page_number: 3,
          heading_path: ['3. Deep Residual Learning', '3.1 Residual Mapping'],
          snippet: 'y = F(x, {W_i}) + x. The operation F + x is performed by a shortcut connection and element-wise addition.',
          relevance_score: 0.98,
          content_type: 'formula',
        },
      ];
    }

    if (enableGraph) {
      answer += `\n\n**[Graph Context Expansion — Structural Dependency Resolution]:**\nFollowing structural dependency edge \`DEPENDS_ON\` (Weight: 1.0) within token budget (${budget} tokens):\nMulti-Head Attention builds directly upon Scaled Dot-Product Attention by projecting queries, keys, and values $h$ times with parameter matrices $W_i^Q, W_i^K, W_i^V$:\n\n$$\\text{MultiHead}(Q, K, V) = \\text{Concat}(\\text{head}_1, \\dots, \\text{head}_h)W^O$$\n\nwhere $\\text{head}_i = \\text{Attention}(QW_i^Q, KW_i^K, VW_i^V)$.`;

      citations.push({
        id: `cit-expanded-${Date.now()}`,
        document_id: 'doc-vaswani-2017',
        document_name: 'Attention Is All You Need',
        document_version_id: options?.targetVersionId || 'ver-vaswani-v2',
        version_tag: targetTag,
        chunk_id: 'chk-vaswani-006',
        page_number: 4,
        heading_path: ['3. Model Architecture', '3.2 Attention', '3.2.2 Multi-Head Attention'],
        snippet: 'MultiHead(Q, K, V) = Concat(head_1, ..., head_h) W^O where head_i = Attention(Q W_i^Q, K W_i^K, V W_i^V)',
        relevance_score: 0.94,
        content_type: 'formula',
        is_graph_expanded: true,
        expansion_justification: 'Traversed DEPENDS_ON edge from Scaled Dot-Product Attention [chk-vaswani-005] within token budget',
      });
    }

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: answer,
      timestamp: new Date().toISOString(),
      citations,
      strategy_used: enableGraph
        ? 'SmartChunk Graph Context Expansion (AST + Dependency Bounded)'
        : 'SmartChunk Structure-Grounded Vector & AST Retrieval',
      target_version_policy: versionPolicy,
      target_version_id: options?.targetVersionId,
      target_version_tag: targetTag,
      follow_ups: [
        'Can you show the Multi-Head Attention equation?',
        'What was the top-5 error rate reduction in ResNet-152?',
        'How does SmartChunk prevent equation truncation?'
      ],
    };

    return Promise.resolve(assistantMsg);
  }

  return apiRequest<ChatMessage>('/api/v1/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      document_id: options?.documentId,
      version_policy: options?.versionPolicy || 'active_only',
      target_version_id: options?.targetVersionId,
      history: options?.conversationHistory,
      strategy: options?.strategy || 'smartchunk_v2',
    }),
  });
}

