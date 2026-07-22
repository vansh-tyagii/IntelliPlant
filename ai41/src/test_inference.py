from inference import predict_failure

def main():

    test_cases = [

        {
            "name": "Healthy Machine",
            "air_temp": 298.5,
            "process_temp": 308.5,
            "rpm": 1550,
            "torque": 40,
            "tool_wear": 10,
            "machine_type": "L"
        },

        {
            "name": "Medium Risk",
            "air_temp": 300,
            "process_temp": 312,
            "rpm": 1300,
            "torque": 60,
            "tool_wear": 150,
            "machine_type": "M"
        },

        {
            "name": "High Risk",
            "air_temp": 305,
            "process_temp": 320,
            "rpm": 900,
            "torque": 75,
            "tool_wear": 250,
            "machine_type": "H"
        }

    ]

    print("=" * 60)

    for test in test_cases:

        print(f"\nTesting : {test['name']}")

        result = predict_failure(
            air_temp=test["air_temp"],
            process_temp=test["process_temp"],
            rpm=test["rpm"],
            torque=test["torque"],
            tool_wear=test["tool_wear"],
            machine_type=test["machine_type"]
        )

        print(result)

    print("\nDone")


if __name__ == "__main__":
    main()