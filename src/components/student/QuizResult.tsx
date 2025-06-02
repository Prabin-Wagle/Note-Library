import React from 'react';
import { CheckCircle, XCircle, Clock, Award, Home, Download } from 'lucide-react';
import { QuizResult } from './QuizPlayer';
import jsPDF from 'jspdf';

interface QuizResultProps {
  result: QuizResult;
  onBackToQuizzes: () => void;
}

const QuizResultComponent: React.FC<QuizResultProps> = ({ 
  result, 
  onBackToQuizzes 
}) => {
  const { quiz, userAnswers, score, totalQuestions, percentage, timeSpent, completedAt } = result;
  // Format numbers to avoid floating point display issues
  const formatScore = (num: number) => {
    return Number(num.toFixed(2));
  };

  const formatPercentage = (num: number) => {
    return Number(num.toFixed(1));
  };

  // PDF Generation Function
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Quiz Result Report', pageWidth / 2, 20, { align: 'center' });
    
    // Quiz Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Quiz: ${quiz.title}`, 20, 40);
    doc.text(`Grade: ${quiz.grade}`, 20, 50);
    if (quiz.subject) doc.text(`Subject: ${quiz.subject}`, 20, 60);
    doc.text(`Completed: ${completedAt.toLocaleString()}`, 20, 70);
    
    // Results Summary
    doc.setFont('helvetica', 'bold');
    doc.text('Results Summary:', 20, 90);
    doc.setFont('helvetica', 'normal');
    doc.text(`Score: ${formatScore(score)}/${totalQuestions} (${formatPercentage(percentage)}%)`, 20, 100);
    doc.text(`Time Spent: ${formatTime(timeSpent)}`, 20, 110);
    doc.text(`Grade: ${getGradeText(percentage)}`, 20, 120);
    
    // Question Details
    let yPosition = 140;
    
    quiz.questions.forEach((question, index) => {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      const userAnswer = userAnswers.find(answer => answer.questionId === question.id);
      const selectedOption = question.options.find(opt => opt.id === userAnswer?.selectedOptionId);
      const correctOption = question.options.find(opt => opt.isCorrect);
      const isCorrect = userAnswer?.isCorrect || false;
      const wasAnswered = !!userAnswer;
      
      // Question header
      doc.setFont('helvetica', 'bold');
      doc.text(`Question ${index + 1}:`, 20, yPosition);
      yPosition += 10;
      
      // Question text or image note
      doc.setFont('helvetica', 'normal');
      if (question.imageLink) {
        doc.text('(Image question - see original quiz)', 20, yPosition);
      } else {
        const questionText = question.questionText || 'Question text not available';
        const lines = doc.splitTextToSize(questionText, pageWidth - 40);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 5;
      }
      yPosition += 5;
      
      // Answer status
      const statusText = wasAnswered 
        ? (isCorrect ? '✓ Correct' : '✗ Incorrect') 
        : '- Not Answered';
      doc.text(`Status: ${statusText}`, 20, yPosition);
      yPosition += 10;
      
      if (wasAnswered && selectedOption) {
        doc.text(`Your Answer: ${selectedOption.text}`, 20, yPosition);
        yPosition += 5;
      }
      
      if (correctOption) {
        doc.text(`Correct Answer: ${correctOption.text}`, 20, yPosition);
        yPosition += 5;
      }
      
      yPosition += 10; // Space between questions
    });
    
    // Save the PDF
    doc.save(`${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_result.pdf`);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100 border-green-200';
    if (percentage >= 80) return 'text-blue-600 bg-blue-100 border-blue-200';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    if (percentage >= 60) return 'text-orange-600 bg-orange-100 border-orange-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getGradeText = (percentage: number) => {
    if (percentage >= 90) return 'Excellent!';
    if (percentage >= 80) return 'Very Good!';
    if (percentage >= 70) return 'Good';
    if (percentage >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  const getPerformanceMessage = (percentage: number) => {
    if (percentage >= 90) return 'Outstanding performance! You have mastered this topic.';
    if (percentage >= 80) return 'Great job! You have a strong understanding of the material.';
    if (percentage >= 70) return 'Good work! Review the missed questions to improve further.';
    if (percentage >= 60) return 'Fair performance. Consider reviewing the material again.';
    return 'Keep practicing! Review the material and try again.';
  };

  // Console log the complete result
  console.log('Quiz Result Display:', {
    quizTitle: quiz.title,
    score: `${score}/${totalQuestions}`,
    percentage: `${percentage}%`,
    timeSpent: formatTime(timeSpent),
    completedAt: completedAt.toLocaleString(),
    userAnswers: userAnswers.map(answer => ({
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId,
      isCorrect: answer.isCorrect
    }))
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back to Quizzes Button - Top */}
        <div className="mb-4 flex justify-start">
          <button
            onClick={onBackToQuizzes}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <Home size={16} />
            Back to Quizzes
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full border-2 ${getGradeColor(percentage)} mb-4`}>
            <Award size={24} />
            <span className="text-xl font-bold">{getGradeText(percentage)}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Quiz Complete!</h1>
          <p className="text-gray-600">{quiz.title}</p>
        </div>

        {/* Score Summary */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-600 mb-1">{formatScore(score)}</div>
              <div className="text-sm text-gray-600">Correct Answers</div>
              <div className="text-xs text-gray-500">out of {totalQuestions}</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600 mb-1">{formatPercentage(percentage)}%</div>
              <div className="text-sm text-gray-600">Score</div>
              <div className="text-xs text-gray-500">Percentage</div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-purple-600 mb-1">{formatTime(timeSpent)}</div>
              <div className="text-sm text-gray-600">Time Spent</div>
              <div className="text-xs text-gray-500">Duration</div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600 mb-1">{quiz.grade}</div>
              <div className="text-sm text-gray-600">Grade Level</div>
              {quiz.subject && <div className="text-xs text-gray-500">{quiz.subject}</div>}
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-center text-gray-700">{getPerformanceMessage(percentage)}</p>
          </div>
        </div>

        {/* Quiz Info */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Quiz Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Quiz Title:</span>
              <span className="font-medium">{quiz.title}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Completed At:</span>
              <span className="font-medium">{completedAt.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Time Limit:</span>
              <span className="font-medium">{quiz.timeLimit} minutes</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Questions Answered:</span>
              <span className="font-medium">{userAnswers.filter(ua => ua.selectedOptionId !== null).length} of {totalQuestions}</span>
            </div>
          </div>
        </div>

        {/* Detailed Results */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Question Review</h2>
          
          <div className="space-y-6">            {quiz.questions.map((question, index) => {
              const userAnswer = userAnswers.find(answer => answer.questionId === question.id);
              const selectedOption = question.options.find(opt => opt.id === userAnswer?.selectedOptionId);
              const isCorrect = userAnswer?.isCorrect || false;
              const wasAnswered = !!userAnswer;

              return (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-4">
                    {wasAnswered ? (
                      isCorrect ? (
                        <CheckCircle className="text-green-500 mt-1 flex-shrink-0" size={20} />
                      ) : (
                        <XCircle className="text-red-500 mt-1 flex-shrink-0" size={20} />
                      )
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full mt-1 flex-shrink-0"></div>
                    )}
                      <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">Question {index + 1}</div>
                      
                      {/* Question Image */}
                      {question.imageLink && (
                        <div className="mb-3">
                          <img 
                            src={question.imageLink} 
                            alt={`Question ${index + 1} image`} 
                            className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              console.warn(`Failed to load image: ${question.imageLink}`);
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Question Text */}
                      {question.questionText && (
                        <h3 className="font-semibold text-gray-800 mb-3">{question.questionText}</h3>
                      )}
                      
                      {/* Show note if question has only image */}
                      {question.imageLink && !question.questionText && (
                        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                          <Clock size={14} className="inline mr-1" />
                          Image-based question
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        {question.options.map((option) => {
                          let optionClass = 'p-3 rounded-lg border ';
                          
                          if (option.isCorrect) {
                            optionClass += 'border-green-500 bg-green-50 text-green-700';
                          } else if (selectedOption?.id === option.id && !option.isCorrect) {
                            optionClass += 'border-red-500 bg-red-50 text-red-700';
                          } else {
                            optionClass += 'border-gray-200 bg-gray-50 text-gray-700';
                          }

                          return (
                            <div key={option.id} className={optionClass}>
                              <div className="flex items-center gap-2">
                                {option.isCorrect && <CheckCircle size={16} className="text-green-600" />}
                                {selectedOption?.id === option.id && !option.isCorrect && (
                                  <XCircle size={16} className="text-red-600" />
                                )}
                                <span>{option.text}</span>
                                {option.isCorrect && (
                                  <span className="ml-auto text-xs font-semibold bg-green-200 text-green-800 px-2 py-1 rounded">
                                    Correct Answer
                                  </span>
                                )}
                                {selectedOption?.id === option.id && !option.isCorrect && (
                                  <span className="ml-auto text-xs font-semibold bg-red-200 text-red-800 px-2 py-1 rounded">
                                    Your Answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {!wasAnswered && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-700">
                            <Clock size={16} />
                            <span className="text-sm font-medium">Not Answered</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={generatePDF}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download size={18} />
            Download PDF Report
          </button>
          <button
            onClick={onBackToQuizzes}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Home size={18} />
            Back to Quizzes
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizResultComponent;
