import os
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

# Load API Key (Make sure GROQ_API_KEY is in your .env)
load_dotenv()

print("Waking up SafeSphere Copilot (Groq Engine)...")

# 1. Load DB (Jo build_db.py ne documents folder se banayi thi)
embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
vector_db = FAISS.load_local("compliance_db", embeddings, allow_dangerous_deserialization=True)

# 2. Setup the Fast LLM (Groq)
llm = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0.1) 

# 3. Ironclad Prompt
prompt_template = """
You are 'SafeSphere Compliance Copilot', an expert industrial safety AI.
Use the following pieces of retrieved safety regulations to answer the question.
If you cannot find the exact answer in the context, say "I cannot find a specific regulation for this in the provided documents." Do NOT invent rules.

Format your response EXACTLY like this:
**Regulation Cited:** [Name of the Act/Guideline from context]
**Explanation:** [Why is this risky or what does the rule state]
**Recommended Action:** [What the user should do right now]

Context: {context}

Question: {question}
Answer:
"""

PROMPT = PromptTemplate(template=prompt_template, input_variables=["context", "question"])

# 4. Retrieval Chain using LCEL (LangChain Expression Language)
retriever = vector_db.as_retriever(search_kwargs={"k": 4})

# Build the chain using modern LCEL approach
qa_chain = (
    {"context": retriever | (lambda docs: "\n\n".join([doc.page_content for doc in docs])), "question": RunnablePassthrough()}
    | PROMPT
    | llm
    | StrOutputParser()
)

def ask_compliance_agent(query):
    print(f"\n🚨 Incident Query: {query}")
    print("-" * 50)
    
    # Run the query - now we get back a string directly
    response = qa_chain.invoke(query)
    
    print(response)
    
    print("-" * 50)
    print("Sources referenced internally:")
    
    # Get source documents for reference
    docs = retriever.invoke(query)
    if docs:
        for doc in docs:
            source = doc.metadata.get('source', 'Unknown')
            print(f"- {os.path.basename(source)}")
    else:
        print("- No direct sources found in context.")

if __name__ == "__main__":
    print("\n" + "="*50)
    print(" SafeSphere RAG Copilot is ONLINE!")
    print("Type your safety questions below. (Type 'exit' to close)")
    print("="*50)
    
    while True:
        # User se live terminal mein question lene ke liye
        user_query = input("\nYou: ")
        
        # Exit command handle karna
        if user_query.lower() in ['exit', 'quit', 'q']:
            print("\nShutting down Copilot. Stay Safe! ")
            break
            
        # Agar galti se khali enter maar diya toh ignore karo
        if not user_query.strip():
            continue
            
        # Live query ko humare agent function mein bhej do
        ask_compliance_agent(user_query)
