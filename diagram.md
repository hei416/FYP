flowchart LR
    subgraph P[Learning Challenges]
        P1[Java syntax is complex & error messages confusing]
        P2[Online tutorials are generic & not adaptive]
        P3[Difficulty applying theory to practice]
        P4[AI responses inconsistent or unreliable]
    end

    subgraph F[Platform Features]
        F1[Compiler Module\nImmediate execution & feedback]
        F2[AI Tutor Module\nError explanations in plain language]
        F3[Lessons Module\nStructured, segmented content]
        F4[RAG-powered AI Tutor\nPersonalized guidance]
        F5[Practical Test Module\nHands-on coding exercises]
        F6[Exercise Library\nReference solutions]
        F7[Verification & Arbitration\nCross-check LLM outputs]
        F8[Database Caching\nConsistent responses & faster retrieval]
    end

    subgraph G[Project Goals]
        G1[Improve comprehension of Java concepts]
        G2[Provide adaptive & personalized feedback]
        G3[Enable effective practice & application]
        G4[Ensure reliable & trustworthy AI support]
    end

    %% Connections Problem → Feature
    P1 --> F1
    P1 --> F2
    P2 --> F3
    P2 --> F4
    P3 --> F5
    P3 --> F6
    P4 --> F7
    P4 --> F8

    %% Connections Feature → Goal
    F1 --> G1
    F2 --> G1
    F3 --> G1
    F4 --> G2
    F5 --> G3
    F6 --> G3
    F7 --> G4
    F8 --> G4
