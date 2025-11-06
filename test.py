from apscheduler.schedulers.background import BackgroundScheduler

def test_job():
    print("Test job executed!")

scheduler = BackgroundScheduler()
scheduler.add_job(test_job, 'interval', seconds=5)
scheduler.start()

import time
time.sleep(10)  # Keep the script running to observe the scheduler