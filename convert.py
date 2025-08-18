import os
import json

ROOT_DIR = "/Users/hei/IdeaProjects/fyp/practical_tests"

def load_file(path):
    if not os.path.exists(path):
        return ""
    with open(path, "r") as f:
        return f.read()

def update_json(set_folder):
    questions_dir = os.path.join(set_folder, "questions")
    base_dir = os.path.join(set_folder, "base")
    solution_dir = os.path.join(set_folder, "solution")

    for file in os.listdir(questions_dir):
        if file.endswith(".json"):
            qid = os.path.splitext(file)[0]  # q1, q2
            json_path = os.path.join(questions_dir, file)

            # Assume filename convention: q1 → Question1.java
            question_id = qid[1:]  # q1 → 1
            base_path = os.path.join(base_dir, f"Question{question_id}.java")
            sol_path = os.path.join(solution_dir, f"Question{question_id}.java")

            base_code = load_file(base_path)
            sol_code = load_file(sol_path)

            with open(json_path, "r") as f:
                qdata = json.load(f)

            qdata["base_code"] = base_code
            qdata["solution_code"] = sol_code

            with open(json_path, "w") as f:
                json.dump(qdata, f, indent=2)

            print(f"✅ Updated {file}")

def main():
    for folder in os.listdir(ROOT_DIR):
        set_path = os.path.join(ROOT_DIR, folder)
        if os.path.isdir(set_path) and "Set" in folder:
            print(f"Processing {folder}...")
            update_json(set_path)

if __name__ == "__main__":
    main()
