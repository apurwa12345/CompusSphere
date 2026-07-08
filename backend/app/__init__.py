import datetime
from flask import Flask, jsonify
from flask.json.provider import DefaultJSONProvider
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from bson import ObjectId
from config import Config

mongo = PyMongo()
jwt = JWTManager()

class CustomJSONProvider(DefaultJSONProvider):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        return super().default(obj)

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Use custom JSON provider for global serialization
    app.json = CustomJSONProvider(app)

    mongo.init_app(app)

    # Fail fast with a clear error if MongoDB is unreachable
    try:
        mongo.cx.admin.command("ping")
    except Exception as exc:
        raise RuntimeError(
            "MongoDB connection failed. Check MONGO_URI and network access."
        ) from exc

    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            "message": "Signature verification failed",
            "error": str(error)
        }), 422

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "message": "The token has expired",
            "error": "token_expired"
        }), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            "message": "Request does not contain an access token",
            "error": "authorization_required"
        }), 401

    @app.route("/api/health", methods=["GET"])
    def health():
        try:
            mongo.cx.admin.command("ping")
            return jsonify({"status": "ok", "mongo": "connected"}), 200
        except Exception as exc:
            return jsonify({
                "status": "error",
                "mongo": "disconnected",
                "error": str(exc)
            }), 500

    # ✅ Root route (NEW)
    @app.route("/", methods=["GET"])
    def home():
        return jsonify({
            "message": "CampusSphere Backend Running",
            "status": "ok"
        }), 200

    # ── Core Blueprints ──────────────────────────────────────────────────────
    from app.routes.auth import auth_bp
    from app.routes.academic import academic_bp
    from app.routes.exam import exam_bp
    from app.routes.marks import marks_bp
    from app.routes.reports import reports_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.accountant import accountant_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(academic_bp, url_prefix='/api/academic')
    app.register_blueprint(exam_bp, url_prefix='/api/exam')
    app.register_blueprint(marks_bp, url_prefix='/api/marks')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(accountant_bp, url_prefix='/api/accountant')

    # ── Exam Cell Module Blueprints ──────────────────────────────────────────
    from app.routes.exam_setup import exam_setup_bp
    from app.routes.exam_forms import exam_forms_bp
    from app.routes.eligibility import eligibility_bp
    from app.routes.timetable import timetable_bp
    from app.routes.seating import seating_bp
    from app.routes.hall_ticket import hall_ticket_bp
    from app.routes.internal_marks import internal_marks_bp
    from app.routes.external_marks import external_marks_bp
    from app.routes.marks_verify import marks_verify_bp
    from app.routes.result_processing import result_processing_bp
    from app.routes.backlog import backlog_bp
    from app.routes.revaluation import revaluation_bp
    from app.routes.supplementary import supplementary_bp
    from app.routes.result_publish import result_publish_bp
    from app.routes.analytics import analytics_bp
    from app.routes.exam_notify import exam_notify_bp
    from app.routes.audit import audit_bp
    from app.routes.exam_settings import exam_settings_bp

    app.register_blueprint(exam_setup_bp, url_prefix='/api/exam-setup')
    app.register_blueprint(exam_forms_bp, url_prefix='/api/exam-forms')
    app.register_blueprint(eligibility_bp, url_prefix='/api/eligibility')
    app.register_blueprint(timetable_bp, url_prefix='/api/timetable')
    app.register_blueprint(seating_bp, url_prefix='/api/seating')
    app.register_blueprint(hall_ticket_bp, url_prefix='/api/hall-ticket')
    app.register_blueprint(internal_marks_bp, url_prefix='/api/internal-marks')
    app.register_blueprint(external_marks_bp, url_prefix='/api/external-marks')
    app.register_blueprint(marks_verify_bp, url_prefix='/api/marks-verify')
    app.register_blueprint(result_processing_bp, url_prefix='/api/results')
    app.register_blueprint(backlog_bp, url_prefix='/api/backlog')
    app.register_blueprint(revaluation_bp, url_prefix='/api/revaluation')
    app.register_blueprint(supplementary_bp, url_prefix='/api/supplementary')
    app.register_blueprint(result_publish_bp, url_prefix='/api/result-publish')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(exam_notify_bp, url_prefix='/api/exam-notifications')
    app.register_blueprint(audit_bp, url_prefix='/api/audit')
    app.register_blueprint(exam_settings_bp, url_prefix='/api/exam-settings')

    return app