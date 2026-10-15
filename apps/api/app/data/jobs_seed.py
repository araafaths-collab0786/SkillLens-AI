"""
Job seed data — 20 roles across IT, data, healthcare support, logistics, skilled trades.
Each role includes:
  - required_skills: weight 1–3 per skill
  - nice_to_have_skills: not scored
  - sdg_aligned: True for all (SDG 8)
  - learning_steps: one recommended step per gap skill (used for projection)
"""

JOBS_SEED: list[dict] = [
    # ── Information Technology ────────────────────────────────────────────
    {
        "title": "Junior Full-Stack Developer",
        "category": "information_technology",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:javascript", "esco_label": "JavaScript", "weight": 3},
            {"esco_uri": "esco:react",      "esco_label": "React",      "weight": 3},
            {"esco_uri": "esco:python",     "esco_label": "Python",     "weight": 2},
            {"esco_uri": "esco:git",        "esco_label": "Git",        "weight": 2},
            {"esco_uri": "esco:sql",        "esco_label": "SQL",        "weight": 2},
            {"esco_uri": "esco:communication", "esco_label": "Communication", "weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:typescript", "esco_label": "TypeScript"},
            {"esco_uri": "esco:docker",     "esco_label": "Docker"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:javascript", "step_type": "course",      "title": "JavaScript Essentials",     "effort_weeks": 6, "step_order": 1},
            {"esco_uri": "esco:react",      "step_type": "project",     "title": "Build a React Portfolio",   "effort_weeks": 4, "step_order": 2},
            {"esco_uri": "esco:python",     "step_type": "course",      "title": "Python for Web Dev",        "effort_weeks": 4, "step_order": 3},
            {"esco_uri": "esco:sql",        "step_type": "course",      "title": "SQL Fundamentals",          "effort_weeks": 3, "step_order": 4},
        ],
    },
    {
        "title": "DevOps Engineer",
        "category": "information_technology",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:docker",      "esco_label": "Docker",     "weight": 3},
            {"esco_uri": "esco:kubernetes",  "esco_label": "Kubernetes", "weight": 3},
            {"esco_uri": "esco:git",         "esco_label": "Git",        "weight": 2},
            {"esco_uri": "esco:python",      "esco_label": "Python",     "weight": 2},
            {"esco_uri": "esco:aws",         "esco_label": "Amazon Web Services", "weight": 2},
            {"esco_uri": "esco:problem_solving", "esco_label": "Problem Solving", "weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:azure",       "esco_label": "Microsoft Azure"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:docker",     "step_type": "course",      "title": "Docker for Beginners",   "effort_weeks": 3, "step_order": 1},
            {"esco_uri": "esco:kubernetes", "step_type": "certification","title": "CKAD Certification",    "effort_weeks": 8, "step_order": 2},
            {"esco_uri": "esco:aws",        "step_type": "certification","title": "AWS Cloud Practitioner","effort_weeks": 6, "step_order": 3},
        ],
    },
    {
        "title": "Backend Python Developer",
        "category": "information_technology",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:python",   "esco_label": "Python",  "weight": 3},
            {"esco_uri": "esco:fastapi",  "esco_label": "FastAPI", "weight": 3},
            {"esco_uri": "esco:sql",      "esco_label": "SQL",     "weight": 2},
            {"esco_uri": "esco:git",      "esco_label": "Git",     "weight": 2},
            {"esco_uri": "esco:docker",   "esco_label": "Docker",  "weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:kubernetes", "esco_label": "Kubernetes"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:python",  "step_type": "course",  "title": "Python Advanced Topics",  "effort_weeks": 4, "step_order": 1},
            {"esco_uri": "esco:fastapi", "step_type": "project", "title": "Build a REST API",        "effort_weeks": 3, "step_order": 2},
            {"esco_uri": "esco:sql",     "step_type": "course",  "title": "PostgreSQL Deep Dive",    "effort_weeks": 3, "step_order": 3},
        ],
    },
    {
        "title": "Frontend Developer (React/TypeScript)",
        "category": "information_technology",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:react",      "esco_label": "React",      "weight": 3},
            {"esco_uri": "esco:typescript", "esco_label": "TypeScript", "weight": 3},
            {"esco_uri": "esco:javascript", "esco_label": "JavaScript", "weight": 2},
            {"esco_uri": "esco:git",        "esco_label": "Git",        "weight": 2},
            {"esco_uri": "esco:communication", "esco_label": "Communication", "weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:sql", "esco_label": "SQL"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:typescript", "step_type": "course",  "title": "TypeScript Fundamentals",  "effort_weeks": 4, "step_order": 1},
            {"esco_uri": "esco:react",      "step_type": "project", "title": "Build a React App",        "effort_weeks": 4, "step_order": 2},
        ],
    },
    # ── Data / Analytics ──────────────────────────────────────────────────
    {
        "title": "Junior Data Analyst",
        "category": "data_analytics",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:sql",          "esco_label": "SQL",          "weight": 3},
            {"esco_uri": "esco:data_analysis","esco_label": "Data Analysis","weight": 3},
            {"esco_uri": "esco:python",       "esco_label": "Python",       "weight": 2},
            {"esco_uri": "esco:communication","esco_label": "Communication","weight": 2},
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:ml", "esco_label": "Machine Learning"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:sql",          "step_type": "course",  "title": "SQL for Data Analysis",       "effort_weeks": 4, "step_order": 1},
            {"esco_uri": "esco:data_analysis","step_type": "project", "title": "Exploratory Data Analysis Project","effort_weeks": 3,"step_order": 2},
            {"esco_uri": "esco:python",       "step_type": "course",  "title": "Python for Data Science",     "effort_weeks": 5, "step_order": 3},
        ],
    },
    {
        "title": "Machine Learning Engineer",
        "category": "data_analytics",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:ml",       "esco_label": "Machine Learning", "weight": 3},
            {"esco_uri": "esco:python",   "esco_label": "Python",           "weight": 3},
            {"esco_uri": "esco:dl",       "esco_label": "Deep Learning",    "weight": 2},
            {"esco_uri": "esco:sql",      "esco_label": "SQL",              "weight": 2},
            {"esco_uri": "esco:git",      "esco_label": "Git",              "weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:tensorflow", "esco_label": "TensorFlow"},
            {"esco_uri": "esco:pytorch",    "esco_label": "PyTorch"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:ml",  "step_type": "course",       "title": "ML Fundamentals",           "effort_weeks": 6, "step_order": 1},
            {"esco_uri": "esco:dl",  "step_type": "course",       "title": "Deep Learning Specialization","effort_weeks": 8, "step_order": 2},
            {"esco_uri": "esco:python","step_type": "project",    "title": "ML Project on GitHub",      "effort_weeks": 4, "step_order": 3},
        ],
    },
    {
        "title": "NLP Research Engineer",
        "category": "data_analytics",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:nlp",    "esco_label": "Natural Language Processing", "weight": 3},
            {"esco_uri": "esco:python", "esco_label": "Python",                      "weight": 3},
            {"esco_uri": "esco:dl",     "esco_label": "Deep Learning",               "weight": 2},
            {"esco_uri": "esco:pytorch","esco_label": "PyTorch",                     "weight": 2},
        ],
        "nice_to_have_skills": [],
        "learning_steps": [
            {"esco_uri": "esco:nlp",    "step_type": "course",  "title": "NLP with Transformers", "effort_weeks": 6, "step_order": 1},
            {"esco_uri": "esco:pytorch","step_type": "project", "title": "NLP Project on GitHub", "effort_weeks": 4, "step_order": 2},
        ],
    },
    {
        "title": "Computer Vision Engineer",
        "category": "data_analytics",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:cv",     "esco_label": "Computer Vision", "weight": 3},
            {"esco_uri": "esco:python", "esco_label": "Python",          "weight": 3},
            {"esco_uri": "esco:dl",     "esco_label": "Deep Learning",   "weight": 2},
            {"esco_uri": "esco:git",    "esco_label": "Git",             "weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:tensorflow", "esco_label": "TensorFlow"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:cv",    "step_type": "course",  "title": "Computer Vision with OpenCV","effort_weeks": 5, "step_order": 1},
            {"esco_uri": "esco:dl",    "step_type": "course",  "title": "CNN Architectures",          "effort_weeks": 6, "step_order": 2},
        ],
    },
    # ── Healthcare Support ────────────────────────────────────────────────
    {
        "title": "Healthcare Data Entry Specialist",
        "category": "healthcare_support",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:communication", "esco_label": "Communication",  "weight": 3},
            {"esco_uri": "esco:data_analysis", "esco_label": "Data Analysis",  "weight": 2},
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 2},
            {"esco_uri": "esco:teamwork",       "esco_label": "Teamwork",       "weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:sql", "esco_label": "SQL"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:data_analysis","step_type": "course","title": "Healthcare Data Management","effort_weeks": 3, "step_order": 1},
        ],
    },
    {
        "title": "Medical Records Technician",
        "category": "healthcare_support",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:communication","esco_label": "Communication",   "weight": 3},
            {"esco_uri": "esco:teamwork",     "esco_label": "Teamwork",        "weight": 2},
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 1},
        ],
        "nice_to_have_skills": [],
        "learning_steps": [
            {"esco_uri": "esco:communication","step_type": "course","title": "Medical Communication","effort_weeks": 2,"step_order": 1},
        ],
    },
    # ── Logistics ─────────────────────────────────────────────────────────
    {
        "title": "Logistics Coordinator",
        "category": "logistics",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:project_mgmt",  "esco_label": "Project Management", "weight": 3},
            {"esco_uri": "esco:communication", "esco_label": "Communication",       "weight": 3},
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving",    "weight": 2},
            {"esco_uri": "esco:teamwork",       "esco_label": "Teamwork",           "weight": 2},
            {"esco_uri": "esco:sql",            "esco_label": "SQL",                "weight": 1},
        ],
        "nice_to_have_skills": [],
        "learning_steps": [
            {"esco_uri": "esco:project_mgmt","step_type": "course","title": "Logistics & Supply Chain","effort_weeks": 4,"step_order": 1},
            {"esco_uri": "esco:sql",         "step_type": "course","title": "SQL for Operations",     "effort_weeks": 3,"step_order": 2},
        ],
    },
    {
        "title": "Supply Chain Analyst",
        "category": "logistics",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:data_analysis","esco_label": "Data Analysis",    "weight": 3},
            {"esco_uri": "esco:sql",          "esco_label": "SQL",              "weight": 3},
            {"esco_uri": "esco:project_mgmt", "esco_label": "Project Management","weight": 2},
            {"esco_uri": "esco:communication","esco_label": "Communication",    "weight": 2},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:python", "esco_label": "Python"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:data_analysis","step_type": "course","title": "Supply Chain Analytics","effort_weeks": 5,"step_order": 1},
            {"esco_uri": "esco:sql",          "step_type": "course","title": "Advanced SQL",          "effort_weeks": 3,"step_order": 2},
        ],
    },
    # ── Skilled Trades ────────────────────────────────────────────────────
    {
        "title": "Electrician Apprentice",
        "category": "skilled_trades",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 3},
            {"esco_uri": "esco:teamwork",        "esco_label": "Teamwork",      "weight": 2},
            {"esco_uri": "esco:communication",   "esco_label": "Communication", "weight": 2},
        ],
        "nice_to_have_skills": [],
        "learning_steps": [
            {"esco_uri": "esco:problem_solving","step_type": "course","title": "Electrical Safety & Theory","effort_weeks": 8,"step_order": 1},
        ],
    },
    {
        "title": "Plumbing Technician",
        "category": "skilled_trades",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 3},
            {"esco_uri": "esco:communication",  "esco_label": "Communication",  "weight": 2},
            {"esco_uri": "esco:teamwork",        "esco_label": "Teamwork",       "weight": 1},
        ],
        "nice_to_have_skills": [],
        "learning_steps": [
            {"esco_uri": "esco:problem_solving","step_type": "course","title": "Plumbing Systems Fundamentals","effort_weeks": 8,"step_order": 1},
        ],
    },
    {
        "title": "CNC Machine Operator",
        "category": "skilled_trades",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 3},
            {"esco_uri": "esco:teamwork",        "esco_label": "Teamwork",       "weight": 2},
            {"esco_uri": "esco:communication",   "esco_label": "Communication",  "weight": 1},
        ],
        "nice_to_have_skills": [],
        "learning_steps": [
            {"esco_uri": "esco:problem_solving","step_type": "course","title": "CNC Programming Basics","effort_weeks": 6,"step_order": 1},
        ],
    },
    {
        "title": "HVAC Technician",
        "category": "skilled_trades",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 3},
            {"esco_uri": "esco:communication",  "esco_label": "Communication",  "weight": 2},
            {"esco_uri": "esco:teamwork",        "esco_label": "Teamwork",       "weight": 1},
        ],
        "nice_to_have_skills": [],
        "learning_steps": [
            {"esco_uri": "esco:problem_solving","step_type": "course","title": "HVAC Fundamentals","effort_weeks": 10,"step_order": 1},
        ],
    },
    # ── Data / Other ──────────────────────────────────────────────────────
    {
        "title": "Data Engineer",
        "category": "data_analytics",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:python",      "esco_label": "Python",      "weight": 3},
            {"esco_uri": "esco:sql",         "esco_label": "SQL",         "weight": 3},
            {"esco_uri": "esco:docker",      "esco_label": "Docker",      "weight": 2},
            {"esco_uri": "esco:git",         "esco_label": "Git",         "weight": 2},
            {"esco_uri": "esco:data_analysis","esco_label": "Data Analysis","weight": 2},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:kubernetes", "esco_label": "Kubernetes"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:python",       "step_type": "project", "title": "ETL Pipeline on GitHub", "effort_weeks": 4, "step_order": 1},
            {"esco_uri": "esco:sql",          "step_type": "course",  "title": "Advanced SQL for Data Eng","effort_weeks": 3, "step_order": 2},
            {"esco_uri": "esco:data_analysis","step_type": "course",  "title": "Data Warehousing",       "effort_weeks": 4, "step_order": 3},
        ],
    },
    {
        "title": "Cloud Solutions Architect (Associate)",
        "category": "information_technology",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:aws",         "esco_label": "Amazon Web Services", "weight": 3},
            {"esco_uri": "esco:docker",      "esco_label": "Docker",             "weight": 2},
            {"esco_uri": "esco:kubernetes",  "esco_label": "Kubernetes",         "weight": 2},
            {"esco_uri": "esco:git",         "esco_label": "Git",                "weight": 1},
            {"esco_uri": "esco:communication","esco_label": "Communication",     "weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:azure", "esco_label": "Microsoft Azure"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:aws","step_type": "certification","title": "AWS Solutions Architect Associate","effort_weeks": 8,"step_order": 1},
        ],
    },
    {
        "title": "IT Support Specialist",
        "category": "information_technology",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:communication",  "esco_label": "Communication",  "weight": 3},
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 3},
            {"esco_uri": "esco:teamwork",        "esco_label": "Teamwork",       "weight": 2},
            {"esco_uri": "esco:git",             "esco_label": "Git",            "weight": 1},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:python", "esco_label": "Python"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:problem_solving","step_type": "certification","title": "CompTIA A+","effort_weeks": 8,"step_order": 1},
        ],
    },
    {
        "title": "Career Guidance Counselor",
        "category": "other",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:communication",  "esco_label": "Communication",  "weight": 3},
            {"esco_uri": "esco:teamwork",        "esco_label": "Teamwork",       "weight": 2},
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 2},
            {"esco_uri": "esco:project_mgmt",   "esco_label": "Project Management","weight": 1},
        ],
        "nice_to_have_skills": [],
        "learning_steps": [
            {"esco_uri": "esco:communication","step_type": "course","title": "Career Counseling Techniques","effort_weeks": 4,"step_order": 1},
        ],
    },
    {
        "title": "Quality Assurance (QA) Engineer",
        "category": "information_technology",
        "sdg_aligned": True,
        "required_skills": [
            {"esco_uri": "esco:python",       "esco_label": "Python",       "weight": 2},
            {"esco_uri": "esco:git",          "esco_label": "Git",          "weight": 2},
            {"esco_uri": "esco:communication","esco_label": "Communication","weight": 2},
            {"esco_uri": "esco:problem_solving","esco_label": "Problem Solving","weight": 3},
        ],
        "nice_to_have_skills": [
            {"esco_uri": "esco:sql", "esco_label": "SQL"},
        ],
        "learning_steps": [
            {"esco_uri": "esco:python","step_type": "course","title": "Test Automation with Python","effort_weeks": 4,"step_order": 1},
            {"esco_uri": "esco:problem_solving","step_type": "project","title": "QA Project on GitHub","effort_weeks": 3,"step_order": 2},
        ],
    },
]
