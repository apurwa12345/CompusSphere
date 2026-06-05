import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import api from "../../services/api";
import "./Home.css";

function Home() {
    const navigate = useNavigate();
    const [isStartModalOpen, setIsStartModalOpen] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);
    const headerHeight = useRef(0);
    const [formStatus, setFormStatus] = useState(null);

    const openModal = () => setIsStartModalOpen(true);
    const closeModal = () => setIsStartModalOpen(false);

    const handleRoleSelect = (role) => {
        closeModal();
        navigate("/login", { state: { selectedRole: role } });
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        setFormStatus(null);

        try {
            const formData = new FormData(e.target);
            const payload = {
                full_name: formData.get("full_name"),
                email: formData.get("email"),
                subject: formData.get("subject"),
                message: formData.get("message"),
            };

            await api.post("/reports/contact", payload);
            setFormStatus("Message sent successfully! We will get back to you soon.");
            setTimeout(() => setFormStatus(null), 5000);
            e.target.reset();
        } catch (err) {
            const message =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to send message. Please try again.";
            setFormStatus(message);
            setTimeout(() => setFormStatus(null), 5000);
        }
    };


    useEffect(() => {
        // slide-in animations
        const animatedBlocks = document.querySelectorAll(
            ".slide-in-left, .slide-in-right, .slide-in-up"
        );
        animatedBlocks.forEach((element, index) => {
            const delay = 180 + index * 120;
            setTimeout(() => {
                element.classList.add("is-visible");
            }, delay);
        });
    }, []);

    useEffect(() => {
        // Get header height on mount
        const header = document.querySelector('.site-header');
        if (header) {
            headerHeight.current = header.offsetHeight;
        }

        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const offset = Math.min(currentScrollY, headerHeight.current);
            setScrollOffset(offset);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        if (isStartModalOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    }, [isStartModalOpen]);

    const currentYear = new Date().getFullYear();

    return (
        <div className="home-container">
            <header className="site-header" style={{
                transform: `translateY(-${scrollOffset}px)`,
                transition: 'none'
            }}>
                <div className="logo" aria-label="MGM logo">
                    <img src={logo} alt="MGM logo" />
                </div>
                <div className="header-text">
                    <h1>MGM's College of Engineering Nanded</h1>
                    <p className="tagline">Centralized Examination Management Portal</p>
                </div>
                <nav className="main-nav">
                    <a href="#about-website">About us</a>
                    <a href="#contact">Contact Us</a>
                    <a
                        href="#login"
                        onClick={(e) => {
                            e.preventDefault();
                            openModal();
                        }}
                    >
                        Login
                    </a>
                </nav>
            </header>

            <main className="page-main">
                {/* Hero */}
                <section id="overview" className="hero">
                    <div className="hero-content slide-in-left">
                        <h2>Streamlined, Secure, Centralized Examination Portal</h2>
                        <p>
                            A unified web-based platform to manage exam schedules, hall
                            tickets, evaluations, and results with ease.
                        </p>
                        <div className="hero-actions">
                            <button
                                className="btn primary"
                                onClick={(e) => {
                                    e.preventDefault();
                                    openModal();
                                }}
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                    <div className="floating-pills" aria-hidden="true">
                        <div className="pill pill-lg pill-1">
                            <span>Exam Schedule</span>
                        </div>
                        <div className="pill pill-md pill-2">
                            <span>Hall Tickets</span>
                        </div>
                        <div className="pill pill-sm pill-3">
                            <span>Evaluation</span>
                        </div>
                        <div className="pill pill-md pill-4">
                            <span>Analytics</span>
                        </div>
                        <div className="pill pill-sm pill-5">
                            <span>Results</span>
                        </div>
                    </div>
                </section>

                {/* About website */}
                <section id="about-website" className="about-website-section">
                    <div className="about-website-inner slide-in-up">
                        <div className="about-website-heading">
                            <h2>About This Portal</h2>
                            <p>
                                This portal is designed to simplify the end‑to‑end examination
                                process for MGM's College of Engineering Nanded. It brings
                                schedules, hall tickets, evaluation workflows and results into
                                one secure, centralized system.
                            </p>
                        </div>
                        <div className="about-website-cards">
                            <div className="about-website-card">
                                <div className="about-website-icon" aria-hidden="true">
                                    📅
                                </div>
                                <h3>Centralized Scheduling</h3>
                                <p>
                                    Create and publish exam timetables across departments with
                                    conflict checks and automated notifications.
                                </p>
                            </div>
                            <div className="about-website-card">
                                <div className="about-website-icon" aria-hidden="true">
                                    🎫
                                </div>
                                <h3>Digital Hall Tickets</h3>
                                <p>
                                    Generate secured hall tickets that students can
                                    access online or download.
                                </p>
                            </div>
                            <div className="about-website-card">
                                <div className="about-website-icon" aria-hidden="true">
                                    🤖
                                </div>
                                <h3>Automated Workflows</h3>
                                <p>
                                    Get Notifications,Analyze,and track evaluation
                                    status from a single dashboard.
                                </p>
                            </div>
                            <div className="about-website-card">
                                <div className="about-website-icon" aria-hidden="true">
                                    📈
                                </div>
                                <h3>Real-time Insights</h3>
                                <p>
                                    Monitor exam progress, submissions, and result trends with
                                    interactive analytics.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Vision & Mission */}
                <section id="about" className="about-section">
                    <div className="about-header">
                        <h2>Vision & Mission</h2>
                        <p>
                            MGM's College of Engineering Nanded is committed to
                            developing proficient engineers with strong values, global outlook
                            and a spirit of service to society.
                        </p>
                    </div>
                    <div className="about-grid">
                        <article className="about-card slide-in-up">
                            <div className="about-card-icon about-vision-icon" aria-hidden="true">
                                🔭
                            </div>
                            <h3>Vision</h3>
                            <p>
                                To be one of the leading institutions for engineering education,
                                developing proficient engineers with global acceptance in the
                                service of mankind.
                            </p>
                        </article>
                        <article className="about-card slide-in-up">
                            <div className="about-card-icon about-mission-icon" aria-hidden="true">
                                🎯
                            </div>
                            <h3>Mission</h3>
                            <ul className="mission-list">
                                <li>
                                    Providing quality Engineering education to cater the needs of
                                    industry and society with multidisciplinary approach on a
                                    sustainable basis.
                                </li>
                                <li>
                                    Developing globally competent engineers able to solve real-life
                                    problems with environmental responsibility.
                                </li>
                                <li>
                                    Inculcating professionalism, teamwork, research, innovation,
                                    and entrepreneurship with continuous learning.
                                </li>
                                <li>
                                    Fostering collaboration with industry, academia, research
                                    organizations, experts and alumni.
                                </li>
                                <li>
                                    Imparting employability skills and leadership with ethical
                                    social values.
                                </li>
                            </ul>
                        </article>
                    </div>
                </section>

                {/* Contact */}
                <section id="contact" className="contact-section">
                    <div className="contact-inner">
                        <div className="contact-heading">
                            <h2>Get in Touch</h2>
                            <p>
                                Have questions about the portal or want to schedule a demo?
                                We're here to help.
                            </p>
                        </div>
                        <form
                            className="contact-form"
                            onSubmit={handleContactSubmit}
                        >
                            <div className="contact-grid">
                                <div className="form-field">
                                    <label htmlFor="full-name">Full Name</label>
                                    <input
                                        id="full-name"
                                        name="full_name"
                                        type="text"
                                        required
                                        placeholder="Type your full name"
                                    />
                                </div>
                                <div className="form-field">
                                    <label htmlFor="email">Email Address</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        placeholder="you@mgmcen.ac.in"
                                    />
                                </div>
                                <div className="form-field">
                                    <label htmlFor="subject">Subject</label>
                                    <input
                                        id="subject"
                                        name="subject"
                                        type="text"
                                        required
                                        placeholder="Portal Access / Demo Request / Query"
                                    />
                                </div>
                                <div className="form-field form-field-full">
                                    <label htmlFor="message">Message</label>
                                    <textarea
                                        id="message"
                                        name="message"
                                        rows={4}
                                        required
                                        placeholder="Write your message here..."
                                    />
                                </div>
                            </div>
                            {formStatus && <p className="form-status-msg">{formStatus}</p>}
                            <button type="submit" className="btn primary contact-submit">
                                Send Message ✦
                            </button>
                        </form>
                    </div>
                </section>
            </main>

            <footer className="site-footer">
                <div className="footer-content">
                    <p>
                        For examination-related queries, contact the Examination Cell at
                        MGM's College of Engineering Nanded.
                    </p>
                    <small>
                        &copy; <span>{currentYear}</span> MGM's College of Engineering
                        Nanded. All rights reserved.
                    </small>
                </div>
            </footer>

            {/* Login type modal */}
            {isStartModalOpen && (
                <div
                    className="start-modal-backdrop is-open"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <div
                        className="start-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="start-modal-title"
                    >
                        <button
                            className="start-modal-close"
                            type="button"
                            aria-label="Close"
                            onClick={closeModal}
                        >
                            &times;
                        </button>
                        <h2 id="start-modal-title">Login Type</h2>
                        <p className="start-modal-subtitle">
                            Please select your role to continue to the portal.
                        </p>
                        <div className="start-modal-options">
                            <button className="start-option" onClick={() => handleRoleSelect("Student")}>
                                <div
                                    className="start-option-icon student-icon"
                                    aria-hidden="true"
                                >
                                    🎓
                                </div>
                                <div className="start-option-text">
                                    <span className="start-option-title">Student Login</span>
                                    <span className="start-option-subtitle">
                                        Access your results, hall tickets & fees
                                    </span>
                                </div>
                                <span className="start-option-arrow" aria-hidden="true">
                                    →
                                </span>
                            </button>
                            <button className="start-option" onClick={() => handleRoleSelect("Faculty")}>
                                <div
                                    className="start-option-icon faculty-icon"
                                    aria-hidden="true"
                                >
                                    👩‍🏫
                                </div>
                                <div className="start-option-text">
                                    <span className="start-option-title">Faculty Login</span>
                                    <span className="start-option-subtitle">
                                        Manage marks, exams & student records
                                    </span>
                                </div>
                                <span className="start-option-arrow" aria-hidden="true">
                                    →
                                </span>
                            </button>
                            <button className="start-option" onClick={() => handleRoleSelect("Exam Cell")}>
                                <div
                                    className="start-option-icon exam-cell-icon"
                                    aria-hidden="true"
                                >
                                    📅
                                </div>
                                <div className="start-option-text">
                                    <span className="start-option-title">Exam Cell Login</span>
                                    <span className="start-option-subtitle">
                                        Manage timetables, hall tickets & results
                                    </span>
                                </div>
                                <span className="start-option-arrow" aria-hidden="true">
                                    →
                                </span>
                            </button>
                            <button className="start-option" onClick={() => handleRoleSelect("Accountant")}> 
                                <div
                                    className="start-option-icon accountant-icon"
                                    aria-hidden="true"
                                >
                                    💼
                                </div>
                                <div className="start-option-text">
                                    <span className="start-option-title">Accountant Login</span>
                                    <span className="start-option-subtitle">
                                        Manage fees, accounts & financial records
                                    </span>
                                </div>
                                <span className="start-option-arrow" aria-hidden="true">
                                    →
                                </span>
                            </button>
                            <button className="start-option" onClick={() => handleRoleSelect("Admin")}>
                                <div
                                    className="start-option-icon admin-icon"
                                    aria-hidden="true"
                                >
                                    🛡️
                                </div>
                                <div className="start-option-text">
                                    <span className="start-option-title">Admin Login</span>
                                    <span className="start-option-subtitle">
                                        Full system control & configuration
                                    </span>
                                </div>
                                <span className="start-option-arrow" aria-hidden="true">
                                    →
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;
