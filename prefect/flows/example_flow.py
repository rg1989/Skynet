"""
Example Prefect flow demonstrating multi-step workflow with Skynet integration.
"""
from prefect import flow, task
import httpx
from datetime import datetime


@task(name="fetch_data", retries=2)
def fetch_data(url: str) -> dict:
    """Fetch data from a URL."""
    response = httpx.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


@task(name="process_data")
def process_data(data: dict) -> dict:
    """Process the fetched data."""
    # Example processing - in real use, this would do something meaningful
    return {
        "processed_at": datetime.now().isoformat(),
        "item_count": len(data) if isinstance(data, list) else 1,
        "data_preview": str(data)[:200]
    }


@task(name="notify_skynet")
def notify_skynet(result: dict, skynet_url: str = "http://localhost:3000") -> dict:
    """Send results back to Skynet via API."""
    # This could trigger an agent run with the results
    payload = {
        "message": f"Workflow completed: {result['item_count']} items processed at {result['processed_at']}",
    }
    
    try:
        response = httpx.post(
            f"{skynet_url}/api/chat",
            json=payload,
            timeout=60
        )
        return {"notified": True, "status": response.status_code}
    except Exception as e:
        return {"notified": False, "error": str(e)}


@flow(name="example_data_pipeline", log_prints=True)
def example_data_pipeline(
    data_url: str = "https://jsonplaceholder.typicode.com/posts/1",
    notify: bool = True
) -> dict:
    """
    Example pipeline that fetches data, processes it, and optionally notifies Skynet.
    
    Args:
        data_url: URL to fetch data from
        notify: Whether to notify Skynet when done
    """
    print(f"Starting pipeline with URL: {data_url}")
    
    # Step 1: Fetch data
    data = fetch_data(data_url)
    print(f"Fetched data: {str(data)[:100]}...")
    
    # Step 2: Process data
    result = process_data(data)
    print(f"Processed: {result['item_count']} items")
    
    # Step 3: Optionally notify Skynet
    if notify:
        notification = notify_skynet(result)
        result["notification"] = notification
    
    print("Pipeline complete!")
    return result


if __name__ == "__main__":
    # Run locally for testing
    result = example_data_pipeline()
    print(f"Result: {result}")
