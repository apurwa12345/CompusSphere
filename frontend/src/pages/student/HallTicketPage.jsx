import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, Eye, RefreshCw } from 'lucide-react';
import { Card, Button } from '../../components/common/UI';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import api from '../../services/api';
import logo from '../../assets/logo.png';

const placeholderPhoto =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="180" viewBox="0 0 160 180">
      <rect width="160" height="180" fill="#e2e8f0"/>
      <circle cx="80" cy="60" r="28" fill="#94a3b8"/>
      <path d="M35 150c8-25 28-38 45-38s37 13 45 38" fill="#94a3b8"/>
      <text x="80" y="170" text-anchor="middle" font-size="12" font-family="Arial" fill="#475569">Student Photo</text>
    </svg>
  `);

const fixedInstructions = [
  'Hall ticket valid only if signed by the competent authority.',
  'No electronic devices, notes, or books are allowed inside the examination hall.',
  'Report 10 minutes before the examination time mentioned in the timetable.',
];

const titleCaseStatus = (status) => status || 'Pending';
const PREVIEW_EXPORT_ID = 'hall-ticket-export-root';

const exportStyleProps = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'letter-spacing',
  'text-align',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'display',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'box-shadow',
  'text-shadow',
  'object-fit',
  'object-position',
  'grid-template-columns',
  'grid-template-rows',
  'gap',
  'column-gap',
  'row-gap',
  'justify-content',
  'align-items',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'overflow',
  'overflow-x',
  'overflow-y',
  'border-collapse',
  'vertical-align',
  'white-space',
];

const colorCache = new Map();

/**
 * Converts modern color functions (like oklch) to hex/rgb using a canvas trick.
 * This helper uses regex to find and replace all color occurrences within a string,
 * making complex properties like box-shadow and gradients compatible with html2canvas.
 */
const convertToCompatibleColor = (val) => {
  if (!val || typeof val !== 'string' || (!val.includes('oklch') && !val.includes('color('))) return val;

  return val.replace(/(oklch|color)\([^)]+\)/g, (match) => {
    if (colorCache.has(match)) return colorCache.get(match);
    try {
      const temp = document.createElement('canvas');
      temp.width = 1;
      temp.height = 1;
      const ctx = temp.getContext('2d');
      ctx.fillStyle = match;
      const converted = ctx.fillStyle;
      colorCache.set(match, converted);
      return converted;
    } catch (e) {
      return match;
    }
  });
};

const applyComputedStyles = (sourceNode, clonedNode) => {
  if (!sourceNode || !clonedNode) return;
  if (sourceNode.nodeType !== Node.ELEMENT_NODE || clonedNode.nodeType !== Node.ELEMENT_NODE) return;

  const sourceElement = sourceNode;
  const clonedElement = clonedNode;
  const computed = window.getComputedStyle(sourceElement);

  exportStyleProps.forEach((prop) => {
    let val = computed.getPropertyValue(prop);

    // Sanitize any value containing oklch for html2canvas compatibility
    val = convertToCompatibleColor(val);

    clonedElement.style.setProperty(prop, val);
  });

  if (clonedElement.tagName === 'IMG') {
    clonedElement.setAttribute('crossorigin', 'anonymous');
  }

  const sourceChildren = Array.from(sourceElement.children);
  const clonedChildren = Array.from(clonedElement.children);
  sourceChildren.forEach((child, index) => {
    applyComputedStyles(child, clonedChildren[index]);
  });
};

export default function HallTicketPage() {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qrCodeSrc, setQrCodeSrc] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const previewRef = useRef(null);

  useEffect(() => {
    // Pre-convert logo to Data URL for reliable PDF printing
    const convertLogo = async () => {
      try {
        const response = await fetch(logo);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoDataUrl(reader.result);
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error('Logo conversion failed:', err);
      }
    };
    convertLogo();
  }, []);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.application_id === selectedId) || tickets[0] || null,
    [tickets, selectedId]
  );

  const fetchTickets = async (keepSelection = true) => {
    setRefreshing(true);
    try {
      const response = await api.get('/hall-ticket/student');
      const items = response.data || [];
      setTickets(items);
      if (!keepSelection || !selectedId || !items.some((item) => item.application_id === selectedId)) {
        setSelectedId(items[0]?.application_id || '');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPreview = async (applicationId) => {
    if (!applicationId) {
      setPreview(null);
      return;
    }
    try {
      const response = await api.get(`/hall-ticket/preview/${applicationId}`);
      setPreview(response.data);
    } catch (error) {
      console.error(error);
      setPreview(null);
    }
  };

  useEffect(() => {
    fetchTickets(false);
  }, []);

  useEffect(() => {
    if (selectedTicket?.application_id) {
      fetchPreview(selectedTicket.application_id);
    }
  }, [selectedTicket?.application_id]);

  useEffect(() => {
    const buildQrCode = async () => {
      const value = preview?.hall_ticket_number || preview?.application_id || '';
      if (!value) {
        setQrCodeSrc('');
        return;
      }
      try {
        const dataUrl = await QRCode.toDataURL(value, {
          margin: 1,
          width: 100,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrCodeSrc(dataUrl);
      } catch (error) {
        console.error(error);
        setQrCodeSrc('');
      }
    };

    buildQrCode();
  }, [preview?.hall_ticket_number, preview?.application_id]);

  const handleDownload = async () => {
    if (!selectedTicket?.application_id || !previewRef.current) return;
    try {
      setDownloading(true);
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const clonedPreview = clonedDoc.getElementById(PREVIEW_EXPORT_ID);
          if (clonedPreview) {
            applyComputedStyles(previewRef.current, clonedPreview);
          }
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;

      // Calculate dimensions to fit exactly on one page
      let imgWidth = pageWidth;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      // If it's still taller than A4, scale it down to fit height
      if (imgHeight > pageHeight) {
        const ratio = pageHeight / imgHeight;
        imgHeight = pageHeight;
        imgWidth = imgWidth * ratio;
      }

      // Center horizontally if width was reduced by scaling
      const xOffset = (pageWidth - imgWidth) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, 0, imgWidth, imgHeight);
      pdf.save(`${preview?.hall_ticket_number || 'hall-ticket'}.pdf`);
    } catch (error) {
      console.error(error);
      alert(error?.message || error.response?.data?.warnings?.join('\n') || 'Failed to download hall ticket.');
    } finally {
      setDownloading(false);
    }
  };

  const instructions = preview?.instructions?.length ? preview.instructions : fixedInstructions;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Examination Hall Ticket</h1>
          <p className="mt-1 text-sm text-slate-500">
            Preview the print-ready university hall ticket and download the official PDF after validation.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => fetchTickets(true)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => selectedTicket && fetchPreview(selectedTicket.application_id)} disabled={!selectedTicket}>
            <Eye className="mr-2 h-4 w-4" />
            Refresh Preview
          </Button>
          <Button onClick={handleDownload} disabled={!selectedTicket || !preview?.is_allowed || downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? 'Preparing PDF...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      <Card className="p-5">
        {loading ? (
          <div className="py-10 text-center text-slate-500">Loading hall ticket details...</div>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center text-slate-500">No exam form applications found for hall ticket generation.</div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Select Application
                </label>
                <select
                  value={selectedTicket?.application_id || ''}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  {tickets.map((ticket) => (
                    <option key={ticket.application_id} value={ticket.application_id}>
                      {ticket.exam_name} ({titleCaseStatus(ticket.status)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTicket && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-semibold text-slate-800">{selectedTicket.exam_name}</h2>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between gap-3">
                      <span>Status</span>
                      <span className="font-medium">{titleCaseStatus(selectedTicket.status)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Eligibility</span>
                      <span className={`font-medium ${selectedTicket.eligible ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {selectedTicket.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Fees</span>
                      <span className={`font-medium ${selectedTicket.fees_paid ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {selectedTicket.fees_paid ? 'PAID' : 'UNPAID'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Hall Ticket No</span>
                      <span className="font-mono text-xs text-slate-700">{selectedTicket.hall_ticket_number || 'Pending'}</span>
                    </div>
                  </div>
                </div>
              )}

              {preview && !preview.is_allowed && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Hall ticket cannot be issued yet.</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {(preview.warnings || []).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
              {preview ? (
                <div id={PREVIEW_EXPORT_ID} ref={previewRef} className="mx-auto w-[210mm] min-w-[210mm] bg-white p-[7mm] text-[11px] text-slate-900 shadow-xl">
                  <div className="border border-slate-700">
                    <div className="grid grid-cols-[70px_1fr_120px] border-b border-slate-700">
                      <div className="flex items-center justify-center border-r border-slate-700 p-1.5">
                        <img
                          src={logoDataUrl || logo}
                          alt="Logo"
                          className="h-14 w-14 object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <div className="px-4 py-3 text-center">
                        <div className="text-[21px] font-bold">{preview.university_name}</div>
                        <div className="mt-1 text-[11px] font-semibold tracking-wide">{preview.header_subtitle}</div>
                        <div className="mt-1 text-[15px] font-bold tracking-wide">EXAMINATION HALL TICKET</div>
                      </div>
                      <div className="border-l border-slate-700 p-2">
                        <img
                          src={preview.student_photo_url || placeholderPhoto}
                          alt="Student"
                          className="h-[96px] w-full border border-slate-700 object-cover"
                          crossOrigin="anonymous"
                        />
                      </div>
                    </div>

                    <table className="w-full border-collapse text-[11px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">Degree / Semester</td>
                          <td className="border border-slate-700 px-2 py-2">{preview.degree_semester}</td>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">Medium</td>
                          <td className="border border-slate-700 px-2 py-2">{preview.medium}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">Hall Ticket No</td>
                          <td className="border border-slate-700 px-2 py-2 font-mono text-[10px]" colSpan={3}>{preview.hall_ticket_number}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">College Name</td>
                          <td className="border border-slate-700 px-2 py-2" colSpan={3}>{preview.college_name}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">Student Name</td>
                          <td className="border border-slate-700 px-2 py-2" colSpan={3}>{preview.student_name}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">PRN Number</td>
                          <td className="border border-slate-700 px-2 py-2 font-mono text-center">{preview.prn}</td>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">Seat Number</td>
                          <td className="border border-slate-700 px-2 py-2 font-mono text-center">{preview.seat_number}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">Phone Number</td>
                          <td className="border border-slate-700 px-2 py-2">{preview.phone_number || '-'}</td>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">Email ID</td>
                          <td className="border border-slate-700 px-2 py-2">{preview.email_id || '-'}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-700 bg-slate-50 px-2 py-2 font-semibold">Exam Center Name / City</td>
                          <td className="border border-slate-700 px-2 py-2" colSpan={3}>{preview.exam_center}</td>
                        </tr>
                      </tbody>
                    </table>

                    <table className="w-full border-collapse text-[10.5px]">
                      <thead>
                        <tr className="bg-slate-50">
                          {['Subject Code', 'Subject Name', 'Exam Date', 'Exam Time', 'Student Signature', 'Supervisor Signature'].map((header) => (
                            <th key={header} className="border border-slate-700 px-2 py-2 text-center font-semibold">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(preview.subjects || []).map((subject) => (
                          <tr key={`${subject.subject_code}-${subject.exam_date}`}>
                            <td className="border border-slate-700 px-2 py-1.5 text-center">{subject.subject_code}</td>
                            <td className="border border-slate-700 px-2 py-1.5">{subject.subject_name}</td>
                            <td className="border border-slate-700 px-2 py-1.5 text-center">{subject.exam_date || '-'}</td>
                            <td className="border border-slate-700 px-2 py-1.5 text-center">{subject.exam_time || '-'}</td>
                            <td className="border border-slate-700 px-2 py-1.5"></td>
                            <td className="border border-slate-700 px-2 py-1.5"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="grid grid-cols-[80px_1fr] gap-2 border-t border-slate-700 p-2">
                      <div className="border border-slate-700 p-1 flex items-center justify-center">
                        {qrCodeSrc ? (
                          <img src={qrCodeSrc} alt="QR Code" className="h-16 w-16 object-contain" />
                        ) : (
                          <div className="text-[8px]">QR</div>
                        )}
                      </div>

                      <div className="border border-slate-700 px-2 py-1.5">
                        <div className="text-[10px] font-bold underline">Important Instructions to Student:</div>
                        <ul className="mt-1 list-disc pl-3 text-[9.5px] leading-tight">
                          {instructions.map((instruction) => (
                            <li key={instruction}>{instruction}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 px-6 pb-6 pt-9 text-center text-[10px]">
                      {['College Stamp', 'Directors Signature'].map((label) => (
                        <div key={label} className="pt-3">
                          <div className="border-t border-slate-700 pt-1.5 font-semibold">{label}</div>
                        </div>
                      ))}
                      <div className="flex flex-col items-center justify-end gap-1 font-semibold text-emerald-700">
                        <CheckCircle className="h-8 w-8" strokeWidth={2.6} />
                        <div>Eligible Student</div>
                      </div>
                    </div>

                    <div className="border-t border-slate-700 bg-slate-50 px-3 py-1.5 text-[9.5px] font-medium italic text-slate-600">
                      Please bring this acknowledgement to the college/university in case of any query.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-500">Select a hall ticket record to preview.</div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
