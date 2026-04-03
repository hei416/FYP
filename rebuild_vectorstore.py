#!/usr/bin/env python3
"""
Rebuild FAISS vectorstores for both Java Knowledge and Platform Guide.
Run: python rebuild_vectorstore.py
"""
import os
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

def main():
    from dotenv import load_dotenv
    load_dotenv()
    
    # Import after .env is loaded
    from rag_system import setup_rag_system
    
    print("\n" + "="*70)
    print("🔄 REBUILDING BOTH VECTORSTORES")
    print("="*70)
    print("\n📚 Source directories:")
    print("  • Java Knowledge:  java_docs/java_knowledge/")
    print("  • Platform Guide:  java_docs/platform_guide/")
    print("\n💾 Target directories:")
    print("  • Java Knowledge:  vectorstore/java_knowledge/")
    print("  • Platform Guide:  vectorstore/platform_guide/")
    print("\n⏱️  This may take 1-2 minutes...\n")
    
    try:
        # Rebuild both vectorstores (no force_delete — preserves checkpoint for resume)
        rag_chain, retriever = setup_rag_system(
            rebuild_java=True,
            rebuild_platform=True,
        )
        
        print("\n" + "="*70)
        print("✅ VECTORSTORE REBUILD COMPLETE!")
        print("="*70)
        print("\nBoth vectorstores are now ready:")
        print("  ✓ Java knowledge vectorstore")
        print("  ✓ Platform guide vectorstore")
        print("\nYou can now start the backend with:")
        print("  uvicorn main:app --reload\n")
        
    except Exception as e:
        print(f"\n❌ ERROR during rebuild: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
