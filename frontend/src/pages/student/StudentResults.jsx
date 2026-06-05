import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Download } from 'lucide-react';
import logo from '../../assets/logo.png';

const StudentResults = () => {
  const [examType, setExamType] = useState('internal'); // 'internal' | 'external'
  const [selectedExam, setSelectedExam] = useState('periodic_test_1');
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Real Data States
  const [studentProfile, setStudentProfile] = useState({
    name: '',
    rollNumber: '',
    branch: '',
    semester: '',
    prn: ''
  });
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [resultsData, setResultsData] = useState([]);
  const [externalStats, setExternalStats] = useState({ sgpa: 0, cgpa: 0, percentage: 0 });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Profile
      const profileRes = await api.get('/auth/profile');
      const profile = profileRes.data;
      setStudentProfile({
        name: profile.name || '',
        rollNumber: profile.roll_no || profile.enrollment_no || '',
        branch: profile.branch || profile.department || '',
        semester: profile.semester || profile.current_semester || '',
        prn: profile.prn || profile.enrollment_no || ''
      });

      // 2. Fetch Exams List
      const examsRes = await api.get('/exam/');
      setExams(examsRes.data);

      // 3. Fetch Subjects
      const subjectsRes = await api.get('/academic/student/subjects');
      setSubjects(subjectsRes.data);
    } catch (err) {
      console.error("Error fetching initial data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleShow = async () => {
    if (!selectedExam) {
      alert("Please select an exam to show results.");
      return;
    }

    try {
      setLoading(true);
      setShowResult(false);
      
      // Find the actual exam ID based on selected option
      let examId = selectedExam;
      if (examType === 'internal') {
        const examMap = {
          'periodic_test_1': exams.find(e => e.name.toLowerCase().includes('periodic test 1') || e.name.toLowerCase().includes('pt1')),
          'mid_semester_exam': exams.find(e => e.name.toLowerCase().includes('mid semester') || e.name.toLowerCase().includes('mid')),
          'periodic_test_2': exams.find(e => e.name.toLowerCase().includes('periodic test 2') || e.name.toLowerCase().includes('pt2'))
        };
        examId = examMap[selectedExam]?._id || selectedExam;
      } else {
        const exam = exams.find(e => e.name.toLowerCase().includes('end semester') || e.name.toLowerCase().includes('final'));
        examId = exam?._id || selectedExam;
      }
      
      const endpoint = examType === 'internal' 
        ? `/internal-marks/my-results/${examId}?exam_type=${selectedExam}`
        : `/results/student/me`;
      
      const res = await api.get(endpoint);
      
      if (examType === 'internal') {
        setResultsData(res.data);
      } else {
        const examResult = res.data.results.find(r => r.exam_id === examId);
        if (!examResult) {
          throw new Error("No result record found for the selected exam.");
        }
        setResultsData(examResult.subject_results || []);
        setExternalStats({
          sgpa: examResult.sgpa || 0,
          cgpa: res.data.cgpa || 0,
          percentage: examResult.percentage || 0
        });
      }
      
      setShowResult(true);
    } catch (err) {
      console.error("Error fetching results:", err);
      const message = err.response?.data?.message || "No result record found for the selected exam.";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setExamType('internal');
    setSelectedExam('');
    setShowResult(false);
    setResultsData([]);
  };

  const handleExamTypeChange = (e) => {
    const newType = e.target.value;
    setExamType(newType);
    setSelectedExam(newType === 'internal' ? 'periodic_test_1' : 'end_semester');
    setShowResult(false);
    setResultsData([]);
  };

  const handlePrint = () => {
    window.print();
  };

  // Define dropdown options based on exam type
  const examOptions = examType === 'internal' 
    ? [
        { value: 'periodic_test_1', label: 'Periodic Test 1' },
        { value: 'mid_semester_exam', label: 'Mid Semester Exam' },
        { value: 'periodic_test_2', label: 'Periodic Test 2' }
      ]
    : [
        { value: 'end_semester', label: 'End Semester' }
      ];

  const totalOutOf = resultsData.reduce((acc, curr) => acc + (curr.max_marks || 0), 0);
  const totalObtained = resultsData.reduce((acc, curr) => acc + (curr.marks || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 flex flex-col items-center">
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 0;
            }
            body { 
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            
            /* Hide specific UI elements that are not part of the mark sheet */
            .print\\:hidden,
            header, nav, aside, footer, button, 
            .sidebar, .topbar, .navbar, .selection-bar, 
            .no-print, [role="navigation"], [role="banner"] {
              display: none !important;
            }

            /* Ensure the results card and its parents are visible and taking full space */
            .marksheet-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 1cm !important;
              box-sizing: border-box !important;
              box-shadow: none !important;
              border: 0 !important;
              visibility: visible !important;
              display: block !important;
              background-color: white !important;
              font-family: 'Times New Roman', Times, serif !important;
            }
            
            /* Reset any padding/margin on main content wrappers that might push the content */
            main, .content-wrapper, .main-container {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              display: block !important;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .marksheet-container table {
              font-size: 9pt !important;
              width: 100% !important;
              font-family: 'Times New Roman', Times, serif !important;
            }
            .marksheet-container h1 { 
              font-size: 16pt !important; 
              font-family: 'Times New Roman', Times, serif !important;
            }
            .marksheet-container h2 { 
              font-size: 12pt !important; 
              font-family: 'Times New Roman', Times, serif !important;
            }
            .marksheet-container p, .marksheet-container div { 
              font-size: 9pt !important; 
              font-family: 'Times New Roman', Times, serif !important;
            }
          }

          /* Apply Times New Roman to results display sections */
          .marksheet-container {
            font-family: 'Times New Roman', Times, serif;
          }

          .results-internal, .results-external {
            font-family: 'Times New Roman', Times, serif;
          }
        `}
      </style>

      <div className="w-full max-w-5xl bg-white shadow-md rounded-lg p-6 mb-6 print:hidden">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-2">Student Results</h2>
        
        {/* Selection Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="radio" 
                value="internal" 
                checked={examType === 'internal'} 
                onChange={handleExamTypeChange}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-gray-700 font-medium">Internal Examination</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="radio" 
                value="external" 
                checked={examType === 'external'} 
                onChange={handleExamTypeChange}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-gray-700 font-medium">External Examination</span>
            </label>
          </div>

          <div className="flex items-center space-x-4 w-full md:w-auto">
            <label className="text-gray-700 font-medium whitespace-nowrap">Exam:</label>
            <select 
              value={selectedExam} 
              onChange={(e) => setSelectedExam(e.target.value)}
              className="flex-1 md:w-64 border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">-- Select Exam --</option>
              {examOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="flex space-x-3 w-full md:w-auto">
            <button 
              onClick={handleShow}
              disabled={loading}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-150 ease-in-out shadow-sm cursor-pointer disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Show'}
            </button>
            <button 
              onClick={handleCancel}
              className="flex-1 md:flex-none bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded-md transition duration-150 ease-in-out shadow-sm cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {showResult && (
        <div className="w-full max-w-5xl marksheet-container print:shadow-none print:m-0 print:p-0">
          {examType === 'internal' ? (
            <div className="bg-white pt-2 pb-6 px-4 results-internal" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              <div className="border-2 border-slate-200 rounded-sm overflow-hidden text-sm shadow-lg print:shadow-none print:border-slate-800">
                <div className="bg-slate-50 text-slate-800 text-center font-medium print:bg-white print:border-b-0">
                  <div className="py-6 border-b-2 border-slate-200 print:border-slate-800">
                    <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-slate-900 leading-none mb-1">Mahatma Gandhi Mission, Nanded</h1>
                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Student Internal Evaluation Statement</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 text-xs divide-y md:divide-y-0 md:divide-x border-b border-slate-200 print:border-slate-800">
                    <div className="p-3">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Exam Title</p>
                      <p className="font-bold text-slate-800">{examOptions.find(o => o.value === selectedExam)?.label}</p>
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Student Details</p>
                      <p className="font-bold text-slate-800">{studentProfile.name} | PRN: {studentProfile.prn}</p>
                    </div>
                  </div>
                  <div className="p-3 text-center border-b border-slate-800 bg-slate-100/50 print:bg-white">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Academic Progress</p>
                    <p className="font-bold text-slate-800 uppercase tracking-tighter">Branch: {studentProfile.branch} | Semester: {studentProfile.semester}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#032b5b] text-white print:text-black print:bg-gray-100">
                        <th className="border border-gray-300 print:border-gray-800 px-4 py-3 text-center font-medium w-16">Sr No</th>
                        <th className="border border-gray-300 print:border-gray-800 px-4 py-3 text-center font-medium">Subject</th>
                        <th className="border border-gray-300 print:border-gray-800 px-4 py-3 text-center font-medium">Subject Code</th>
                        <th className="border border-gray-300 print:border-gray-800 px-4 py-3 text-center font-medium">Out Of Marks</th>
                        <th className="border border-gray-300 print:border-gray-800 px-4 py-3 text-center font-medium">Obtained Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultsData.map((row, idx) => (
                        <tr key={idx} className="bg-white">
                          <td className="border border-gray-300 print:border-gray-800 px-4 py-2 text-center text-gray-800">{idx + 1}</td>
                          <td className="border border-gray-300 print:border-gray-800 px-4 py-2 text-gray-800 text-left">{row.subject_name}</td>
                          <td className="border border-gray-300 print:border-gray-800 px-4 py-2 text-center text-gray-800">{row.subject_code}</td>
                          <td className="border border-gray-300 print:border-gray-800 px-4 py-2 text-center text-gray-800">{row.max_marks}</td>
                          <td className={`border border-gray-300 print:border-gray-800 px-4 py-2 text-center font-bold print:text-black`}>
                            {row.status === 'PENDING' ? (
                              <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded uppercase tracking-widest font-black">Pending</span>
                            ) : (
                              (() => {
                                // Color rule: marks < 8 => red, marks >= 8 => green (8 is green)
                                const marksNum = parseFloat(row.marks);
                                const passed = !isNaN(marksNum) ? (marksNum >= 8) : false;
                                return (
                                  <span className={passed ? 'text-green-600' : 'text-red-600'}>
                                    {row.marks}
                                  </span>
                                );
                              })()
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 text-gray-900 font-semibold print:text-black print:bg-white">
                        <td colSpan="3" className="border border-gray-300 print:border-gray-800 px-4 py-2 text-center tracking-wide uppercase text-xs">Grand Total</td>
                        <td className="border border-gray-300 print:border-gray-800 px-4 py-2 text-center">{totalOutOf}</td>
                        <td className="border border-gray-300 print:border-gray-800 px-4 py-2 text-center text-blue-800 print:text-black">{totalObtained}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="mt-6 flex justify-center print:hidden">
                <button 
                  onClick={handlePrint}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-8 rounded shadow-md text-sm font-medium transition duration-150 ease-in-out cursor-pointer"
                >
                  Export PDF / Print
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow-xl rounded-lg p-4 md:p-8 border border-gray-200 relative print:shadow-none print:border-0 print:p-0 results-external" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              {/* Marksheet Header */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="flex items-center justify-between w-full mb-4 px-4">
                  <div className="w-24 h-24 flex-shrink-0">
                    <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 px-4">
                    <h1 className="text-xl md:text-3xl font-black text-gray-900 uppercase leading-tight tracking-tight">Mahatma Gandhi Mission College Of Engineering Nanded</h1>
                    <p className="text-sm md:text-lg font-bold text-gray-700 uppercase tracking-widest mt-1">(An Autonomous Institute)</p>
                  </div>
                </div>
                <h2 className="text-lg font-bold border-y-2 border-gray-800 w-full py-1.5 uppercase tracking-[0.3em] mt-2 bg-gray-50">SEMESTER GRADE REPORT</h2>
              </div>

              {/* Student Info Grid */}
              <div className="mb-6 text-[13px] border-b border-gray-300 pb-4 space-y-1.5">
                <div className="flex">
                  <div className="w-40 font-bold text-gray-600 uppercase text-[11px]">EXAMINATION</div>
                  <div className="flex-1 font-semibold text-gray-900">: {examOptions.find(o => o.value === selectedExam)?.label} EXAMINATIONS {new Date().getFullYear()}</div>
                </div>
                
                <div className="flex">
                  <div className="w-40 font-bold text-gray-600 uppercase text-[11px]">FACULTY</div>
                  <div className="flex-1 font-semibold text-gray-900">: ENGINEERING AND TECHNOLOGY</div>
                </div>

                <div className="flex">
                  <div className="w-40 font-bold text-gray-600 uppercase text-[11px]">INSTITUTE NAME</div>
                  <div className="flex-1 font-bold text-gray-900">: MAHATMA GANDHI MISSION'S COLLEGE OF ENGINEERING, NANDED</div>
                </div>

                <div className="flex">
                  <div className="w-40 font-bold text-gray-600 uppercase text-[11px]">PROGRAMME</div>
                  <div className="flex-1 font-semibold text-gray-900 uppercase">: BACHELOR OF TECHNOLOGY ({studentProfile.branch})</div>
                </div>

                <div className="flex items-center">
                  <div className="w-40 font-bold text-gray-600 uppercase text-[11px]">PRN</div>
                  <div className="w-80 font-semibold text-gray-900">: {studentProfile.prn}</div>
                  <div className="flex-1 flex justify-end items-center">
                    <span className="font-bold text-gray-600 uppercase text-[11px] mr-12">SEMESTER</span>
                    <span className="font-semibold text-gray-900">: {studentProfile.semester || '1'}</span>
                  </div>
                </div>

                <div className="flex">
                  <div className="w-40 font-bold text-gray-600 uppercase text-[11px]">STUDENT'S NAME</div>
                  <div className="flex-1 font-bold text-gray-900 uppercase">: {studentProfile.name}</div>
                </div>
              </div>

              {/* Main Grades Table */}
              <div className="mb-6 overflow-hidden border border-gray-800">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-800">
                      <th className="border-r border-gray-800 px-4 py-2 text-left font-bold text-gray-700 uppercase text-[11px]">SUBJECT CODE</th>
                      <th className="border-r border-gray-800 px-4 py-2 text-left font-bold text-gray-700 uppercase text-[11px]">SUBJECT NAME</th>
                      <th className="border-r border-gray-800 px-4 py-2 text-center font-bold text-gray-700 uppercase text-[11px]">CREDITS</th>
                      <th className="px-4 py-2 text-center font-bold text-gray-700 uppercase text-[11px]">GRADE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultsData.map((row, index) => (
                      <tr key={index} className="border-b border-gray-300 last:border-b-0 hover:bg-gray-50 transition-colors">
                        <td className="border-r border-gray-800 px-4 py-1.5 text-gray-800 font-medium text-xs">{row.subject_code}</td>
                        <td className="border-r border-gray-800 px-4 py-1.5 font-medium text-gray-800 text-xs">{row.subject_name}</td>
                        <td className="border-r border-gray-800 px-4 py-1.5 text-center text-gray-800 font-medium text-xs">{row.credits}</td>
                        <td className={`px-4 py-1.5 text-center font-bold text-xs ${row.grade === 'FF' ? 'text-red-600' : 'text-gray-900'}`}>
                          {row.grade}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Performance Summary Grid */}
              <div className="mb-8 border border-gray-800 overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-gray-800 border-b border-gray-800 bg-gray-50">
                  <div className="p-1.5 text-center font-bold text-[10px] uppercase tracking-wider">CURRENT SEMESTER PERFORMANCE</div>
                  <div className="p-1.5 text-center font-bold text-[10px] uppercase tracking-wider">CUMULATIVE PERFORMANCE</div>
                </div>
                <div className="grid grid-cols-6 divide-x divide-gray-800 text-center font-bold text-[9px] bg-gray-50 border-b border-gray-800">
                  <div className="p-1">CREDITS</div>
                  <div className="p-1">GRADE POINTS</div>
                  <div className="p-1">SGPA</div>
                  <div className="p-1">CREDITS</div>
                  <div className="p-1">GRADE POINTS</div>
                  <div className="p-1">CGPA</div>
                </div>
                <div className="grid grid-cols-6 divide-x divide-gray-800 text-center text-sm py-2">
                  <div className="p-1">{resultsData.reduce((acc, r) => acc + (parseFloat(r.credits) || 0), 0)}</div>
                  <div className="p-1">{resultsData.some(row => row.grade === 'FF') ? '-' : (externalStats.sgpa * resultsData.reduce((acc, r) => acc + (parseFloat(r.credits) || 0), 0)).toFixed(1)}</div>
                  <div className="p-1 font-extrabold text-blue-700">{resultsData.some(row => row.grade === 'FF') ? '-' : externalStats.sgpa}</div>
                  <div className="p-1">{resultsData.reduce((acc, r) => acc + (parseFloat(r.credits) || 0), 0)}</div>
                  <div className="p-1">{resultsData.some(row => row.grade === 'FF') ? '-' : (externalStats.cgpa * resultsData.reduce((acc, r) => acc + (parseFloat(r.credits) || 0), 0)).toFixed(1)}</div>
                  <div className="p-1 font-extrabold text-indigo-700">{resultsData.some(row => row.grade === 'FF') ? '-' : externalStats.cgpa}</div>
                </div>
              </div>

              {/* Marksheet Footer */}
              <div className="mt-12 flex justify-between items-end px-4">
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-800">DATE : {new Date().toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-center relative">
                  {/* Digital Signature Placeholder */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-60">
                    <img src="https://signature.freefire-name.com/img.php?f=10&t=Controller" alt="" className="h-12 w-auto grayscale" />
                  </div>
                  <div className="w-48 border-t border-gray-800 mt-8 mb-1"></div>
                  <p className="text-[10px] font-bold text-gray-800 uppercase tracking-widest">CONTROLLER OF EXAMINATIONS</p>
                </div>
              </div>

              {/* Watermark / Logo for Background (Optional for print) */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-0">
                <img src={logo} alt="" className="w-[400px] h-[400px]" />
              </div>

              <div className="mt-10 flex justify-center print:hidden">
                <button 
                  onClick={handlePrint}
                  className="bg-[#032b5b] hover:bg-[#044081] text-white py-2.5 px-10 rounded shadow-lg text-sm font-bold transition duration-150 ease-in-out cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  DOWNLOAD / PRINT GRADE REPORT
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentResults;