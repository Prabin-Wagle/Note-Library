import React, { useState, ChangeEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import { saveQuizToFirestore } from '../../services/firestore/quizService'; // Import saveQuizToFirestore

export interface QuizQuestion {
  id: string; // Unique ID for the question
  questionNo: string;
  question: string;
  imageLink?: string; // Image link for the question
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctOption: string;
  marks: string;
}

export interface QuizDetails {
  id: string; // Unique ID for the quiz
  title: string;
  grade: string | 'IOE' | 'CEE' | 'None' | ''; // Updated to include IOE and CEE
  timeLimit: number;
  targetAudience: 'all' | 'authenticated' | 'non-authenticated';
}

// Helper function to convert ^ notation to superscript
const toSuperscript = (str: string): string => {
  if (!str) return '';
  return str.replace(/\^(-?\d+)/g, (_, numStr) => { // Capture optional minus sign
    const superscriptDigits: { [key: string]: string } = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
    };
    let isNegative = false;
    let digitsToConvert = numStr;
    if (numStr.startsWith('-')) {
      isNegative = true;
      digitsToConvert = numStr.substring(1);
    }
    const convertedDigits = digitsToConvert.split('').map((digit: string) => superscriptDigits[digit] || digit).join('');
    return isNegative ? `⁻${convertedDigits}` : convertedDigits;
  });
};

const TestingQuizzes: React.FC = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [quiz, setQuiz] = useState<{ data: QuizQuestion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null); // Stores the ID of the question being edited
  const [editedQuestionData, setEditedQuestionData] = useState<QuizQuestion | null>(null);  const [quizDetails, setQuizDetails] = useState<QuizDetails>({
    id: uuidv4(), // Initialize with a unique ID
    title: '',
    grade: '', // Grade now includes IOE/CEE
    timeLimit: 30,
    targetAudience: 'all',
  });
  const [isSubmitting, setIsSubmitting] = useState(false); // For loading state during submission
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  
  const handleQuizDetailsChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setQuizDetails(prevDetails => {
      const newDetails = {
        ...prevDetails,
        [name]: name === 'timeLimit' ? parseInt(value, 10) : value,
      };
      
      return newDetails;
    });
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonInput(e.target.value);
    setError(null);
  };

  // Function to clean the JSON input before parsing
  const cleanJsonInput = (input: string) => {
    try {
      // Replace any special characters that might cause issues
      let cleaned = input
        .replace(/[\u0000-\u001F]+/g, '') // Remove control characters
        .replace(/\\r\\n/g, '\\n')        // Normalize line breaks
        .trim();
      
      return cleaned;
    } catch (err) {
      return input;
    }
  };

  // Function to load sample data
  const loadSampleData = () => { // Removed async
    try {
      setLoading(true);
      setError(null);
      
      const sampleJson = `[
  {
    "questionNo":"1",
    "question":"What is the capital of France?",
    "imageLink": null,
    "option1":"Berlin",
    "option2":"Madrid",
    "option3":"Paris",
    "option4":"Rome",
    "correctOption":"3",
    "marks":"1"
  },
  {
    "questionNo":"2",
    "question":"Example with x^2 and y^3. What is 2+2?",
    "imageLink": null,
    "option1":"3",
    "option2":"4",
    "option3":"5",
    "option4":"Option with ^4",
    "correctOption":"2",
    "marks":"2"
  },
  {
    "questionNo":"3",
    "question":"",
    "imageLink":"/questionImages/example-image.jpg",
    "option1":"Option 1",
    "option2":"Option 2",
    "option3":"Option 3",
    "option4":"Option 4",
    "correctOption":"3",
    "marks":"1"
  }
]`;
      setJsonInput(sampleJson);
      console.log("Sample data loaded directly into input.");

    } catch (err) { // Should not happen with direct string assignment, but good for robustness
      console.error('Error setting sample data:', err);
      setError(`Failed to load sample data: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const parseQuiz = () => {
    try {
      setLoading(true);
      setError(null);
      setEditingQuestionId(null); // Reset editing state
      setEditedQuestionData(null);
      
      let jsonStringToParse = cleanJsonInput(jsonInput); // Basic cleaning

      // Attempt to fix common input format: list of objects not wrapped in an array
      if (jsonStringToParse && jsonStringToParse.trim() !== '') {
        const trimmedContent = jsonStringToParse.trim();
        if (!trimmedContent.startsWith('[')) {
          // Content doesn't start with an array bracket.
          // Assume it's a single object or a comma-separated list of objects.
          let coreContent = trimmedContent;
          // Remove a potential trailing comma from the end of the entire sequence
          if (coreContent.endsWith(',')) {
            coreContent = coreContent.slice(0, -1); 
          }
          // Wrap the core content in array brackets
          jsonStringToParse = `[${coreContent}]`;
        } else {
          // Content already starts with '[', check for trailing comma before the final ']'
          // e.g., "[{...},{...},]"
          const lastCharBeforeClosingBracket = trimmedContent.charAt(trimmedContent.length - 2);
          if (lastCharBeforeClosingBracket === ',' && trimmedContent.endsWith(']')) {
            jsonStringToParse = trimmedContent.slice(0, trimmedContent.length - 2) + ']';
          }
        }
      }
      
      const parsedData = JSON.parse(jsonStringToParse);
      
      let rawQuizData: any[] = [];
      
      if (Array.isArray(parsedData)) {
        // Check if it's an array of objects with expected keys (basic validation for robustness)
        // This check assumes that if it's an array, it's the new direct format.
        // An empty array is also valid.
        if (parsedData.length === 0 || (parsedData.length > 0 && typeof parsedData[0] === 'object' && parsedData[0] !== null)) {
            rawQuizData = parsedData;
        } else {
            // It's an array, but not of objects, which is not the expected format.
            setError('Invalid quiz format. Expected a direct array of question objects.');
            setLoading(false);
            return;
        }
      } else {
        setError('Invalid quiz format. Expected an array of questions.');
        setLoading(false);
        return;
      }
      // Assign unique IDs and validate
      const validatedQuizData: QuizQuestion[] = rawQuizData.map((q, index) => {
        // Allow empty questions if they have an image, otherwise all fields are required
        if (!q.questionNo || 
            ((!q.question || q.question.trim() === '') && (!q.imageLink || q.imageLink.trim().toLowerCase() === 'null' || q.imageLink.trim() === '')) || 
            !q.option1 || !q.option2 || !q.option3 || !q.option4 || 
            !q.correctOption || !q.marks) {
          throw new Error(`Question at index ${index} is missing required fields.`);
        }
        // Ensure correctOption is a valid value (1-4)
        let validatedCorrectOption = q.correctOption;
        if (q.correctOption === "0" || !["1", "2", "3", "4"].includes(q.correctOption)) {
          console.warn(`Question ${index+1} has invalid correctOption value "${q.correctOption}". Setting to "1" as default.`);
          validatedCorrectOption = "1";
        }
          // Handle image link
        let finalImageLink: string | null = null; // Default to null
        if (q.imageLink && typeof q.imageLink === 'string' && q.imageLink.trim() !== '' && q.imageLink.trim().toLowerCase() !== 'null') {
          finalImageLink = q.imageLink.trim();
        }

        // Log warning for questions with no text but with an image
        if ((!q.question || q.question.trim() === '') && finalImageLink) {
          console.warn(`Question ${index+1} has no text but includes an image: ${finalImageLink}`);
        }
        
        return {
          ...q,
          imageLink: finalImageLink, // Use the new variable that can be null
          correctOption: validatedCorrectOption,
          id: uuidv4(), // Assign a unique ID to each question
        };
      });
      
      setQuiz({ data: validatedQuizData });
      // Count questions with images
      const questionsWithImages = validatedQuizData.filter(q => 
        q.imageLink && q.imageLink !== 'null' && q.imageLink !== ''
      ).length;
      
      console.log(
        'Successfully parsed quiz with', 
        validatedQuizData.length, 
        'questions', 
        questionsWithImages > 0 ? `(${questionsWithImages} with images)` : ''
      );
    } catch (err) {
      setError(err instanceof Error ? `Error parsing quiz: ${err.message}` : 'Invalid JSON format. Please check your input.');
      console.error('Error parsing quiz JSON:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (question: QuizQuestion) => {
    setEditingQuestionId(question.id); // Use question ID
    setEditedQuestionData({ ...question });
  };

  const handleEditChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (editedQuestionData) {
      setEditedQuestionData({
        ...editedQuestionData,
        [e.target.name]: e.target.value,
      });
    }
  };

  const handleSaveEdit = () => {
    if (quiz && editedQuestionData) {
      const updatedQuizData = quiz.data.map(q =>
        q.id === editedQuestionData.id ? editedQuestionData : q // Compare by ID
      );
      setQuiz({ data: updatedQuizData });
      setEditingQuestionId(null);
      setEditedQuestionData(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingQuestionId(null);
    setEditedQuestionData(null);
  };

  const handleSubmitQuiz = async () => {
    // Initial checks are now primarily handled by the button's disabled state,
    // but kept here as a final safeguard.
    if (!quizDetails.title.trim()) {
      alert("Quiz Title is required.");
      return;
    }
    if (!quizDetails.grade) {
      alert("Quiz Grade is required.");
      return;
    }
    if (!quiz || quiz.data.length === 0) {
      alert("Please parse or add questions to the quiz.");
      return;
    }

    const userId = currentUser?.uid;
    if (!userId) {
        alert("User not authenticated. Cannot submit quiz.");
        return;
    }

    setIsSubmitting(true);
    setError(null);

    const completeQuizData = {
      details: quizDetails, 
      questions: quiz.data, 
    };

    try {
      console.log("Submitting Quiz Data to Firestore:", JSON.stringify(completeQuizData, null, 2));
      await saveQuizToFirestore(completeQuizData, userId);
      alert("Quiz submitted successfully to Firestore!");
      
      // Optionally, reset form or navigate away
      setQuiz(null);
      setJsonInput('');
      setQuizDetails({ id: uuidv4(), title: '', grade: '', timeLimit: 30, targetAudience: 'all' });

    } catch (err) {
      console.error("Error submitting quiz to Firestore:", err);
      setError(err instanceof Error ? `Error submitting quiz: ${err.message}` : "An unknown error occurred during submission.");
      alert("Failed to submit quiz to Firestore. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate if the form is ready for submission for the button's disabled state
  const canSubmit = 
    quizDetails.title.trim() !== '' &&
    quizDetails.grade !== '' &&
    quiz !== null &&
    quiz.data.length > 0 &&
    !!currentUser?.uid && // Ensures currentUser and uid exist
    !isSubmitting;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">
        Testing Quizzes / Create Quiz
      </h2>

      {/* Quiz Details Section */}
      <div className="bg-white shadow-md rounded-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3">Quiz Details</h3>
        {/* Quiz ID display - useful for debugging */}
        <p className="text-xs text-gray-500 mb-2">Quiz ID: {quizDetails.id}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Quiz Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="title"
              id="title"
              value={quizDetails.title}
              onChange={handleQuizDetailsChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            />
          </div>          <div>
            <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-1">Grade / Exam Type <span className="text-red-500">*</span></label>
            <select
              name="grade"
              id="grade"
              value={quizDetails.grade}
              onChange={handleQuizDetailsChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select Grade / Exam Type</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
              <option value="IOE">IOE</option>
              <option value="CEE">CEE</option>
              <option value="None">None</option>
            </select>
          </div>
          <div>
            <label htmlFor="timeLimit" className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes) <span className="text-red-500">*</span></label>
            <input
              type="number"
              name="timeLimit"
              id="timeLimit"
              value={quizDetails.timeLimit}
              onChange={handleQuizDetailsChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
            <div className="mt-2 space-y-2 md:space-y-0 md:flex md:space-x-4">
              <div className="flex items-center">
                <input
                  id="all"
                  name="targetAudience"
                  type="radio"
                  value="all"
                  checked={quizDetails.targetAudience === 'all'}
                  onChange={handleQuizDetailsChange}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                />
                <label htmlFor="all" className="ml-2 block text-sm text-gray-900">All Users</label>
              </div>
              <div className="flex items-center">
                <input
                  id="authenticated"
                  name="targetAudience"
                  type="radio"
                  value="authenticated"
                  checked={quizDetails.targetAudience === 'authenticated'}
                  onChange={handleQuizDetailsChange}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                />
                <label htmlFor="authenticated" className="ml-2 block text-sm text-gray-900">Authenticated Users Only</label>
              </div>
              <div className="flex items-center">
                <input
                  id="non-authenticated"
                  name="targetAudience"
                  type="radio"
                  value="non-authenticated"
                  checked={quizDetails.targetAudience === 'non-authenticated'}
                  onChange={handleQuizDetailsChange}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                />
                <label htmlFor="non-authenticated" className="ml-2 block text-sm text-gray-900">Non-Authenticated Users Only</label>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3">
          Enter Quiz JSON
        </h3>
        <textarea
          className="w-full h-64 p-3 border border-gray-300 rounded-md mb-4 font-mono text-sm"
          value={jsonInput}
          onChange={handleJsonChange}
          placeholder={`[
  {
    "questionNo":"1",
    "question":"What is the capital of France?",
    "imageLink": null,
    "option1":"Berlin",
    "option2":"Madrid",
    "option3":"Paris",
    "option4":"Rome",
    "correctOption":"3",
    "marks":"1"
  },
  {
    "questionNo":"2",
    "question":"What is 2+2?",
    "imageLink": null,
    "option1":"3",
    "option2":"4",
    "option3":"5",
    "option4":"6",
    "correctOption":"2",
    "marks":"2"
  }
  // ... more questions
]`}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2"
          onClick={parseQuiz}
          disabled={loading || isSubmitting} // Keep existing disabled logic for this button
        >
          Parse Quiz
        </button>
        <button
          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 mr-2"
          onClick={loadSampleData}
          disabled={loading || isSubmitting}
        >
          {loading ? 'Loading...' : 'Load Sample Data'}
        </button>
        <button
          className={`px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 ${!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleSubmitQuiz}
          disabled={!canSubmit}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Quiz'} 
        </button>        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 font-medium">Error:</p>
            <pre className="text-red-600 text-sm whitespace-pre-wrap">{error}</pre>
          </div>
        )}
      </div>

      {quiz && (
        <div className="bg-white shadow-md rounded-md p-6">          <h3 className="text-lg font-semibold mb-3">
            Quiz Preview
          </h3>          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <p><strong>Questions:</strong> {quiz.data.length}</p>
            <p><strong>Grade/Exam:</strong> {quizDetails.grade || 'Not specified'}</p>
          </div>
          <div className="mt-4">
            {quiz.data.map((question) => (
              <div key={question.id} className="mb-4 p-3 border border-gray-200 rounded-md"> {/* Use question.id as key */}
                {editingQuestionId === question.id && editedQuestionData ? ( // Compare with question.id
                  // Edit Mode
                  <div>
                     <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700">Question ID (auto-generated):</label>
                      <input
                        type="text"
                        name="id"
                        value={editedQuestionData.id}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm"
                        disabled
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700">Question No:</label>
                      <input
                        type="text"
                        name="questionNo"
                        value={editedQuestionData.questionNo}
                        onChange={handleEditChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled // Usually questionNo is not editable, but can be enabled if needed
                      />
                    </div>                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700">Question:</label>
                      <textarea
                        name="question"
                        value={editedQuestionData.question}
                        onChange={handleEditChange}
                        rows={3}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700">Image Link (leave empty if none):</label>
                      <input
                        type="text"
                        name="imageLink"
                        value={editedQuestionData.imageLink || ""}
                        onChange={handleEditChange}
                        placeholder="/questionImages/example.jpg"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      {editedQuestionData.imageLink && editedQuestionData.imageLink !== 'null' && editedQuestionData.imageLink !== '' && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Image Preview:</p>
                          <img 
                            src={editedQuestionData.imageLink.startsWith('/') ? editedQuestionData.imageLink : `/${editedQuestionData.imageLink}`} 
                            alt="Question image preview" 
                            className="max-w-full h-auto max-h-40 rounded border border-gray-200"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = '/a.png'; // Fallback image
                              console.log('Failed to load image preview');
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {['option1', 'option2', 'option3', 'option4'].map((opt, index) => (
                      <div className="mb-2" key={opt}>
                        <label className="block text-sm font-medium text-gray-700">Option {index + 1}:</label>
                        <input
                          type="text"
                          name={opt}
                          value={editedQuestionData[opt as keyof QuizQuestion]}
                          onChange={handleEditChange}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                    ))}
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700">Correct Option (1-4):</label>
                      <select
                        name="correctOption"
                        value={editedQuestionData.correctOption}
                        onChange={handleEditChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700">Marks:</label>
                      <input
                        type="text"
                        name="marks"
                        value={editedQuestionData.marks}
                        onChange={handleEditChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div className="mt-3 flex justify-end space-x-2">
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div>                    <p className="font-semibold mb-1">
                      Q{toSuperscript(question.questionNo)}{question.question && question.question.trim() !== '' ? `: ${toSuperscript(question.question)}` : ''}
                    </p>                    {question.imageLink && question.imageLink !== 'null' && question.imageLink !== '' && (
                      <div className="mb-2">
                        <img 
                          src={question.imageLink.startsWith('/') ? question.imageLink : `/${question.imageLink}`} 
                          alt={`Question ${question.questionNo} image`} 
                          className="max-w-full h-auto rounded-md shadow-sm border border-gray-200" 
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = '/a.png'; // Fallback image
                            console.warn(`Failed to load image for question ${question.questionNo}: ${question.imageLink}`);
                          }}
                        />
                        {!question.question || question.question.trim() === '' ? 
                          <p className="text-xs text-gray-500 mt-1">This question is image-only</p> : null}
                      </div>
                    )}
                    <ul className="list-disc list-inside ml-4 mb-1">
                      <li>Option 1: {toSuperscript(question.option1)}</li>
                      <li>Option 2: {toSuperscript(question.option2)}</li>
                      <li>Option 3: {toSuperscript(question.option3)}</li>
                      <li>Option 4: {toSuperscript(question.option4)}</li>
                    </ul>                    <p className="text-sm text-green-600 mb-1">
                      Correct Option: {question.correctOption && question.correctOption !== "0" ? `Option ${question.correctOption}` : "Not set"}
                    </p>
                    <p className="text-sm text-blue-600 mb-2">
                      Marks: {toSuperscript(question.marks)}
                    </p>
                    {/* Display Question ID in view mode - useful for debugging */}
                    <p className="text-xs text-gray-400 mb-2">ID: {question.id}</p> 
                    <button
                      onClick={() => handleEditClick(question)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestingQuizzes;
