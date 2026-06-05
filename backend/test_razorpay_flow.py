import os
import sys
from unittest.mock import patch, MagicMock

# Add current directory to path so 'app' can be imported regardless of cwd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Mock PIL and pkg_resources to avoid corrupted imports on this machine
sys.modules['PIL'] = MagicMock()
sys.modules['PIL.Image'] = MagicMock()
sys.modules['pkg_resources'] = MagicMock()
sys.modules['PIL.Image'] = MagicMock()

from app import create_app, mongo

app = create_app()
app.config['TESTING'] = True
client = app.test_client()

def test_full_payment_flow():
    with app.app_context():
        # Find any active student
        student = mongo.db.students.find_one({})
        if not student:
            print("No student found in DB to test with.")
            return
            
        print(f"Testing with student: {student.get('email')}")
        
        # We don't have the password, but we can generate a JWT token directly
        from flask_jwt_extended import create_access_token
        access_token = create_access_token(identity=student['email'], additional_claims={'role': 'Student'})
        headers = {'Authorization': f'Bearer {access_token}'}
        
        # We need an upcoming exam
        exam = mongo.db.exams.find_one({'status': 'Upcoming'})
        if not exam:
            # Create a dummy exam
            res = mongo.db.exams.insert_one({
                'name': 'Test Exam 2026',
                'semester': student.get('current_semester', 1),
                'status': 'Upcoming'
            })
            exam_id = str(res.inserted_id)
        else:
            exam_id = str(exam['_id'])

        print(f"Using Exam ID: {exam_id}")
        
        # Cleanup any previous application for this exam/student to ensure fresh test
        from bson.objectid import ObjectId
        mongo.db.exam_applications.delete_many({
            'exam_id': ObjectId(exam_id),
            'studentId': student['_id']
        })

        # 1. Test create-razorpay-order
        with patch('app.routes.exam_forms.razorpay_client.order.create') as mock_create_order:
            mock_create_order.return_value = {'id': 'order_dummy123', 'amount': 100, 'currency': 'INR'}
            
            res = client.post('/api/exam-forms/create-razorpay-order', json={'amount': 1}, headers=headers)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.data}"
            order_data = res.get_json()
            assert order_data['id'] == 'order_dummy123'
            print("[SUCCESS] create-razorpay-order successful")

        # 2. Test apply with razorpay
        with patch('app.routes.exam_forms.razorpay_client.utility.verify_payment_signature') as mock_verify:
            mock_verify.return_value = True # Signature matches
            
            payload = {
                'exam_id': exam_id,
                'subjects': [], 
                'fee_acknowledged': True,
                'payment_method': 'razorpay',
                'payment_initiated_at': '2026-05-01T00:00:00Z',
                'razorpay_order_id': 'order_dummy123',
                'razorpay_payment_id': 'pay_dummy456',
                'razorpay_signature': 'sig_dummy789'
            }
            
            # Since subjects are required to be > 0:
            subject = mongo.db.subjects.find_one({})
            if subject:
                payload['subjects'] = [str(subject['_id'])]
            else:
                res = mongo.db.subjects.insert_one({'name': 'Test Subject', 'code': 'TS101'})
                payload['subjects'] = [str(res.inserted_id)]

            res = client.post('/api/exam-forms/apply', json=payload, headers=headers)
            assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.data}"
            print("[SUCCESS] apply API successful with Razorpay metadata")
            
            # 3. Check DB for verification
            app_doc = mongo.db.exam_applications.find_one({
                'exam_id': ObjectId(exam_id),
                'studentId': student['_id']
            })
            
            assert app_doc is not None, "Application not saved in DB"
            assert app_doc['paymentStatus'] == 'VERIFIED', f"paymentStatus is {app_doc['paymentStatus']}"
            assert app_doc['status'] == 'Approved', f"status is {app_doc['status']}"
            assert app_doc['razorpay_order_id'] == 'order_dummy123'
            assert app_doc['fees_paid'] == True
            print("[SUCCESS] Database payment status auto-updated to VERIFIED and Approved correctly!")
            print("\n[SUCCESS] All End-to-End backend tests passed!")

if __name__ == '__main__':
    test_full_payment_flow()
