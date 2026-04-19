import { useState } from 'react';
import { Sparkles, RefreshCw, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAiAPI, handleAPIError } from '../../utils/api';

const DEFAULT_FORM = {
  topic: '',
  difficulty: 'medium',
  gradeLevel: '',
  language: 'English',
  questionType: 'multiple-choice',
  questionCount: 5,
  choicesCount: 4,
  instructions: '',
};

const AdminAiQuestionDevtool = () => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const generatedQuestions = Array.isArray(generated?.questions)
    ? generated.questions
    : generated
      ? [generated]
      : [];

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setGenerated(null);
  };

  const copyRawJson = async () => {
    if (!generated?.raw) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(generated.raw, null, 2));
      toast.success('Raw JSON copied to clipboard');
    } catch {
      toast.error('Unable to copy JSON from this browser');
    }
  };

  const generateQuestion = async (event) => {
    event.preventDefault();

    if (!form.topic.trim()) {
      toast.error('Topic is required');
      return;
    }

    try {
      setIsGenerating(true);

      const response = await adminAiAPI.generateQuestion({
        topic: form.topic,
        difficulty: form.difficulty,
        gradeLevel: form.gradeLevel,
        language: form.language,
        questionType: form.questionType,
        instructions: form.instructions,
        questionCount: Number(form.questionCount),
        choicesCount: Number(form.choicesCount),
      });

      if (response.status === 'success') {
        setGenerated(response.data);
        toast.success('Questions generated');
      }
    } catch (error) {
      toast.error(handleAPIError(error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">AI Question Devtool</h3>
          <p className="text-sm text-gray-600">
            Generate 5 or more short classroom-ready multiple-choice questions from Gemini.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          <Sparkles className="h-4 w-4" />
          Super Admin Tool
        </span>
      </div>

      <form onSubmit={generateQuestion} className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Topic</label>
          <input
            value={form.topic}
            onChange={(event) => updateField('topic', event.target.value)}
            type="text"
            placeholder="Example: Fractions, Photosynthesis, Basic Programming"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Difficulty</label>
          <select
            value={form.difficulty}
            onChange={(event) => updateField('difficulty', event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Questions Per Prompt</label>
          <input
            value={form.questionCount}
            onChange={(event) => updateField('questionCount', event.target.value)}
            type="number"
            min="5"
            max="10"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Choices Count</label>
          <input
            value={form.choicesCount}
            onChange={(event) => updateField('choicesCount', event.target.value)}
            type="number"
            min="2"
            max="6"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Grade Level (optional)</label>
          <input
            value={form.gradeLevel}
            onChange={(event) => updateField('gradeLevel', event.target.value)}
            type="text"
            placeholder="Example: Grade 6"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Language</label>
          <input
            value={form.language}
            onChange={(event) => updateField('language', event.target.value)}
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Extra Instructions (optional)</label>
          <textarea
            value={form.instructions}
            onChange={(event) => updateField('instructions', event.target.value)}
            rows={3}
            placeholder="Example: Use a real-world scenario and keep vocabulary simple."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isGenerating}
            className="btn btn-primary"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Questions
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="btn btn-secondary"
            disabled={isGenerating}
          >
            Reset
          </button>
        </div>
      </form>

      {generated && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="mb-3 text-base font-semibold text-gray-900">
              Generated Questions ({generatedQuestions.length})
            </h4>

            <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
              {generatedQuestions.map((questionItem, questionIndex) => {
                const questionDisplay = questionItem?.questionDisplay || {};
                const hasStructuredQuestion = Boolean(
                  questionDisplay.lead
                    || questionDisplay.ask
                    || (questionDisplay.contextLines || []).length,
                );
                const displayQuestion = questionItem?.formattedQuestion || questionItem?.question || '';
                const hints = Array.isArray(questionItem?.hints) ? questionItem.hints.slice(0, 2) : [];

                return (
                  <div key={`${questionItem?.question || 'question'}-${questionIndex}`} className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Question {questionIndex + 1}
                    </p>

                    {hasStructuredQuestion ? (
                      <div className="mb-4 space-y-3 text-gray-900">
                        {questionDisplay.lead && (
                          <p className="leading-relaxed">{questionDisplay.lead}</p>
                        )}

                        {(questionDisplay.contextLines || []).length > 0 && (
                          <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-900">
{questionDisplay.contextLines.join('\n')}
                          </pre>
                        )}

                        {questionDisplay.ask && (
                          <p className="font-medium leading-relaxed">{questionDisplay.ask}</p>
                        )}
                      </div>
                    ) : (
                      <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-900">
{displayQuestion}
                      </pre>
                    )}

                    <div className="space-y-2">
                      {questionItem.choices?.map((choice, index) => {
                        const isCorrect = index === questionItem.answerIndex;

                        return (
                          <div
                            key={`${choice}-${questionIndex}-${index}`}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              isCorrect
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                                : 'border-gray-200 bg-gray-50 text-gray-800'
                            }`}
                          >
                            <span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}.</span>
                            {choice}
                            {isCorrect && <span className="ml-2 text-xs font-semibold">(Correct)</span>}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-semibold">Explanation</p>
                      <p className="mt-1">{questionItem.explanation}</p>
                    </div>

                    <div className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
                      <p className="font-semibold">Hints</p>
                      <p className="mt-1">Hint 1: {hints[0] || 'Review the question details carefully.'}</p>
                      <p className="mt-1">Hint 2: {hints[1] || 'Work through each option step by step.'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-gray-900">Raw JSON</h4>
              <button type="button" onClick={copyRawJson} className="btn btn-secondary text-xs">
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-gray-950 p-3 text-xs leading-relaxed text-green-200">
{JSON.stringify(generated.raw || generated, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAiQuestionDevtool;
